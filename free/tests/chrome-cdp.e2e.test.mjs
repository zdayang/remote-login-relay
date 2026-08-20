import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import test from 'node:test';
import WebSocket from 'ws';
import {CDPSession, listChromeTabs, selectExactTab} from '../../core/cdp-session.mjs';

const chromeBinary = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const waitForTab = async (cdpHttp, chrome) => {
  for (let index=0; index<100; index += 1) {
    if (chrome.exitCode !== null) throw new Error(`Chrome exited early: ${chrome.exitCode}`);
    try { const tabs=await listChromeTabs(cdpHttp); if(tabs.some(tab=>tab.url==='about:blank')) return tabs; } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Timed out waiting for Chrome CDP');
};

test('shared core controls one real isolated Chrome tab and receives a frame', {timeout:30000}, async (t) => {
  try { await import('node:fs/promises').then(fs=>fs.access(chromeBinary)); }
  catch { t.skip('Google Chrome is not installed'); return; }
  const profile=await mkdtemp(path.join(os.tmpdir(),'toolarks-relay-chrome-')), port=19400+Math.floor(Math.random()*300);
  const chrome=spawn(chromeBinary,[`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
  let cdp;
  try {
    const cdpHttp=`http://127.0.0.1:${port}`, tabs=await waitForTab(cdpHttp,chrome), target=selectExactTab(tabs,'about:blank');
    cdp=new CDPSession({target,WebSocketImpl:WebSocket,mobile:true});
    let frameResolve; const frame=new Promise(resolve=>frameResolve=resolve); cdp.onFrame=frameResolve;
    await cdp.connect();
    const html='<main><label>Private code <input id="code" autofocus></label><p id="result">ready</p></main>';
    await cdp.call('Page.navigate',{url:`data:text/html,${encodeURIComponent(html)}`});
    await new Promise(resolve=>setTimeout(resolve,250));
    await cdp.call('Runtime.evaluate',{expression:'document.querySelector("#code").focus()'});
    await cdp.input({type:'text',text:'local-only-secret'});
    const value=await cdp.call('Runtime.evaluate',{expression:'document.querySelector("#code").value',returnByValue:true});
    assert.equal(value.result.value,'local-only-secret');
    const firstFrame=await Promise.race([frame,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No screencast frame received')),3000))]);
    assert.ok(firstFrame.data.length>100);
  } finally {
    await cdp?.close().catch(()=>{}); if(chrome.exitCode===null)chrome.kill('SIGTERM'); await new Promise(resolve=>chrome.once('exit',resolve)); await rm(profile,{recursive:true,force:true});
  }
});
