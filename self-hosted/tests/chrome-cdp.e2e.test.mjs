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

function jpegSize(data) {
  const bytes = Buffer.from(data, 'base64');
  for (let offset = 2; offset + 8 < bytes.length;) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return {height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7)};
    }
    offset += 2 + length;
  }
  throw new Error('JPEG dimensions not found');
}

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
    assert.deepEqual(jpegSize(firstFrame.data), {width:780,height:1400});
    const highFrame = new Promise((resolve) => {
      cdp.onFrame = (candidate) => {
        if (jpegSize(candidate.data).width === 1560) resolve(candidate);
      };
    });
    await cdp.input({type:'captureMode',mode:'high'});
    const enlarged = await Promise.race([highFrame,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No high-resolution frame received')),3000))]);
    assert.deepEqual(jpegSize(enlarged.data), {width:1560,height:2800});
  } finally {
    await cdp?.close().catch(()=>{}); if(chrome.exitCode===null)chrome.kill('SIGTERM'); await new Promise(resolve=>chrome.once('exit',resolve)); await rm(profile,{recursive:true,force:true});
  }
});
