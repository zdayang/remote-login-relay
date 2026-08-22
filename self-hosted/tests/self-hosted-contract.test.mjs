import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {selectExactTab} from '../../core/cdp-session.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const read=(path)=>readFile(join(root,path),'utf8');

test('tab selection fails closed for zero or ambiguous matches',()=>{
  const tabs=[{id:'1',title:'Login — A',url:'https://a.example/login'},{id:'2',title:'Login — B',url:'https://b.example/login'}];
  assert.equal(selectExactTab(tabs,'a.example').id,'1');
  assert.throws(()=>selectExactTab(tabs,'login'),/More than one/);
  assert.throws(()=>selectExactTab(tabs,'missing'),/No Chrome tab/);
});

test('self-hosted package has no founder-specific path',async()=>{
  const files=await Promise.all(['README.md','README.zh-CN.md','SKILL.md','scripts/start.sh','scripts/configure.sh','scripts/setup.sh','scripts/test-email.sh','src/email.mjs','src/self-hosted-gateway.mjs','public/index.html'].map(read));
  const combined=files.join('\n');
  assert.doesNotMatch(combined,/\/Users\/yang|growth-machine|remote\.toolarks\.com/);
  assert.match(combined,/one exact Chrome tab/i);
  assert.match(combined,/不共享整个桌面/u);
  assert.match(combined,/toolarks\.com\/(en|zh)\/remote-login-relay/i);
  assert.match(combined,/smtp/i);
  assert.match(combined,/Quick Tunnel/i);
});

test('public health endpoint is restricted by host',async()=>{
  const gateway=await read('src/self-hosted-gateway.mjs');
  assert.match(gateway,/\['127\.0\.0\.1', 'localhost', '::1'\]/);
  assert.match(gateway,/res\.writeHead\(404\)\.end\('Not found'\)/);
});

test('installer includes the shared core beside the installed package',async()=>{
  const installer=await read('scripts/install.sh');
  assert.match(installer,/PACKAGE_ROOT\/\.\.\/core/);
  assert.match(installer,/SKILL_ROOT\/core/);
});
