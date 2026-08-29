import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import test from 'node:test';
import WebSocket from 'ws';
import {fileURLToPath} from 'node:url';
import {listChromeTabs, selectExactTab} from '../../core/cdp-session.mjs';

const chromeBinary = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const waitFor = async (check, timeout = 10000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await Promise.resolve().then(check).catch(() => null);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for self-hosted relay');
};

test('self-hosted gateway delivers a frame and remote text input', {timeout: 40000}, async (t) => {
  try { await import('node:fs/promises').then((fs) => fs.access(chromeBinary)); }
  catch { t.skip('Google Chrome is not installed'); return; }

  const profile = await mkdtemp(path.join(os.tmpdir(), 'toolarks-relay-gateway-'));
  const chromePort = 19700 + Math.floor(Math.random() * 200);
  const relayPort = chromePort + 1;
  const token = 'test-token-123';
  const chrome = spawn(chromeBinary, [`--remote-debugging-port=${chromePort}`, `--user-data-dir=${profile}`, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], {stdio: 'ignore'});
  let relay;
  let socket;
  try {
    const cdpHttp = `http://127.0.0.1:${chromePort}`;
    const tabs = await waitFor(async () => {
      const values = await listChromeTabs(cdpHttp);
      return values.some((tab) => tab.url === 'about:blank') ? values : null;
    });
    const target = selectExactTab(tabs, 'about:blank');
    const html = '<label>Code <input id="code" autofocus></label><p id="status">ready</p><script>setInterval(()=>status.textContent=String(Date.now()),16)</script>';
    await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(`data:text/html,${encodeURIComponent(html)}`)}`, {method: 'PUT'}).catch(() => {});
    const pages = await waitFor(async () => {
      const values = await listChromeTabs(cdpHttp);
      return values.find((tab) => tab.url.startsWith('data:text/html'));
    });
    const targetId = pages.id || target.id;
    relay = spawn(process.execPath, ['src/self-hosted-gateway.mjs'], {
      cwd: packageRoot,
      env: {...process.env, REMOTE_RELAY_TOKEN: token, REMOTE_RELAY_TARGET_ID: targetId, REMOTE_RELAY_CDP_HTTP: cdpHttp, REMOTE_RELAY_PORT: String(relayPort), REMOTE_RELAY_EXPIRES_SECONDS: '60'},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const errors = [];
    relay.stderr.on('data', (chunk) => errors.push(chunk.toString()));
    await waitFor(async () => (await fetch(`http://127.0.0.1:${relayPort}/health`).then((response) => response.ok).catch(() => false)) ? true : null);
    const freshPreflight = await fetch(`http://127.0.0.1:${relayPort}/preflight`);
    assert.equal(freshPreflight.status, 200, errors.join(''));
    const response = await fetch(`http://127.0.0.1:${relayPort}/api/tab?token=${token}`);
    assert.equal(response.status, 200, errors.join(''));
    socket = new WebSocket(`ws://127.0.0.1:${relayPort}/ws?token=${token}`);
    const messages = [];
    socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    await waitFor(() => messages.find((message) => message.type === 'attached'));
    const firstFrame = await waitFor(() => messages.find((message) => message.type === 'frame'));
    assert.ok(firstFrame.frameId, 'frames must carry an id for phone-side backpressure');
    const inputStartedAt = Date.now();
    socket.send(JSON.stringify({type: 'text', text: 'from-phone', actionId: 'latency-check'}));
    const inputAck = await waitFor(() => messages.find((message) => message.type === 'inputAck' && message.actionId === 'latency-check'));
    assert.equal(inputAck.ok, true);
    assert.ok(Date.now() - inputStartedAt < 750, `input acknowledgement was too slow: ${Date.now() - inputStartedAt}ms`);
    socket.send(JSON.stringify({type: 'frameAck', frameId: firstFrame.frameId}));
    const value = await waitFor(async () => {
      const values = await listChromeTabs(cdpHttp);
      const page = values.find((tab) => tab.id === targetId);
      if (!page) return null;
      const wsUrl = page.webSocketDebuggerUrl;
      const cdp = new WebSocket(wsUrl);
      await new Promise((resolve, reject) => { cdp.once('open', resolve); cdp.once('error', reject); });
      let id = 0;
      const result = await new Promise((resolve, reject) => {
        cdp.on('message', (data) => { const message = JSON.parse(data.toString()); if (message.id === 1) resolve(message.result?.result?.value); });
        cdp.send(JSON.stringify({id: ++id, method: 'Runtime.evaluate', params: {expression: 'document.querySelector("#code")?.value', returnByValue: true}}));
        setTimeout(() => reject(new Error('evaluate timeout')), 1000);
      });
      cdp.close();
      return result === 'from-phone' ? result : null;
    });
    assert.equal(value, 'from-phone');
    const activePage = (await listChromeTabs(cdpHttp)).find((tab) => tab.id === targetId);
    const inspectionSocket = new WebSocket(activePage.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { inspectionSocket.once('open', resolve); inspectionSocket.once('error', reject); });
    await new Promise((resolve, reject) => {
      inspectionSocket.on('message', (data) => { const message = JSON.parse(data.toString()); if (message.id === 1) resolve(); });
      inspectionSocket.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {expression: `document.body.innerHTML='<h1>Your session has timed out.</h1><p>Sign in again to resume.</p>'`}}));
      setTimeout(() => reject(new Error('expired-page setup timeout')), 1000);
    });
    inspectionSocket.close();
    const expiredPreflight = await fetch(`http://127.0.0.1:${relayPort}/preflight`);
    assert.equal(expiredPreflight.status, 409, 'expired third-party login pages must be rejected before link delivery');
    assert.equal((await expiredPreflight.json()).reason, 'expired');
  } finally {
    socket?.close();
    if (relay?.exitCode === null) relay.kill('SIGTERM');
    if (relay) await new Promise((resolve) => relay.once('exit', resolve));
    if (chrome.exitCode === null) chrome.kill('SIGTERM');
    if (chrome) await new Promise((resolve) => chrome.once('exit', resolve));
    await rm(profile, {recursive: true, force: true});
  }
});
