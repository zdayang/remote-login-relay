import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket, {WebSocketServer} from 'ws';
import {CDPSession, listChromeTabs} from '../../core/cdp-session.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(root);
const port = Number(process.env.REMOTE_RELAY_PORT || 6081);
const token = process.env.REMOTE_RELAY_TOKEN || '';
const targetId = process.env.REMOTE_RELAY_TARGET_ID || '';
const cdpHttp = process.env.REMOTE_RELAY_CDP_HTTP || 'http://127.0.0.1:9222';
const expiresSeconds = Number(process.env.REMOTE_RELAY_EXPIRES_SECONDS || 1800);
if (!token || !targetId) throw new Error('REMOTE_RELAY_TOKEN and REMOTE_RELAY_TARGET_ID are required.');

const indexHtml = await readFile(join(packageRoot, 'public', 'index.html'));
const safeEqual = (left, right) => left.length === right.length && Buffer.from(left).equals(Buffer.from(right));
const authorized = (requestUrl, req) => {
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '') || new URL(requestUrl, 'http://localhost').searchParams.get('token') || '';
  return safeEqual(supplied, token);
};

async function selectedTab() {
  const tabs = await listChromeTabs(cdpHttp);
  const tab = tabs.find((item) => item.id === targetId);
  if (!tab) throw new Error('The selected Chrome tab has closed.');
  return tab;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
        'content-security-policy': "default-src 'self'; connect-src 'self' wss: ws:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
        'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer',
      });
      res.end(indexHtml); return;
    }
    if (url.pathname === '/api/tab') {
      if (!authorized(req.url, req)) { res.writeHead(401).end('Unauthorized'); return; }
      const tab = await selectedTab();
      res.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
      res.end(JSON.stringify({tab: {id: tab.id, title: tab.title, url: tab.url}})); return;
    }
    if (url.pathname === '/health') {
      const host = String(req.headers.host || '').replace(/^\[/, '').split(/[:\]]/)[0].toLowerCase();
      if (!['127.0.0.1', 'localhost', '::1'].includes(host)) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, {'content-type': 'text/plain'}).end('ok'); return;
    }
    res.writeHead(404).end('Not found');
  } catch (error) { res.writeHead(500, {'content-type': 'text/plain'}).end(error.message); }
});

const wss = new WebSocketServer({noServer: true});
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws' || !authorized(req.url, req)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', async (client) => {
  const session = new CDPSession({target: await selectedTab(), WebSocketImpl: WebSocket, mobile: true});
  session.onFrame = ({data, metadata}) => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({type: 'frame', data, metadata}));
  };
  try {
    const target = await session.connect();
    client.send(JSON.stringify({type: 'attached', target: {id: target.id, title: target.title, url: target.url}}));
  } catch (error) { client.send(JSON.stringify({type: 'error', message: error.message})); }
  client.on('message', async (raw) => {
    try { await session.input(JSON.parse(raw.toString())); }
    catch (error) { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({type: 'error', message: error.message})); }
  });
  client.on('close', () => session.close().catch(() => {}));
});

const timer = setTimeout(() => server.close(), Math.min(expiresSeconds, 7200) * 1000);
timer.unref();
server.listen(port, '127.0.0.1', () => console.log(`Remote Login Relay listening on 127.0.0.1:${port}`));
