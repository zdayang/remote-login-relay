import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {assessLoginPageState, selectExactTab} from '../../core/cdp-session.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const read=(path)=>readFile(join(root,path),'utf8');

test('tab selection fails closed for zero or ambiguous matches',()=>{
  const tabs=[{id:'1',title:'Login — A',url:'https://a.example/login'},{id:'2',title:'Login — B',url:'https://b.example/login'}];
  assert.equal(selectExactTab(tabs,'a.example').id,'1');
  assert.throws(()=>selectExactTab(tabs,'login'),/More than one/);
  assert.throws(()=>selectExactTab(tabs,'missing'),/No Chrome tab/);
});

test('login readiness rejects explicit expiry without guessing from page age or URL substrings',()=>{
  assert.deepEqual(assessLoginPageState({title:'Your session has timed out.',text:'Sign in again to resume.',url:'https://id.example/signin',pageAgeMs:1000}),{ready:false,reason:'expired'});
  assert.deepEqual(assessLoginPageState({title:'Sign In',text:'Welcome',url:'https://id.example/signin',pageAgeMs:60*60*1000}),{ready:true});
  assert.deepEqual(assessLoginPageState({title:'Author dashboard',text:'Books',url:'https://example.com/author/books',pageAgeMs:60*60*1000}),{ready:true});
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

test('start runs a local login-page preflight before tunnel and link delivery',async()=>{
  const [gateway,start]=await Promise.all([read('src/self-hosted-gateway.mjs'),read('scripts/start.sh')]);
  assert.match(gateway,/url\.pathname === '\/preflight'/);
  assert.match(gateway,/await session\.preflight\(\)/);
  assert.match(start,/http:\/\/127\.0\.0\.1:\$PORT\/preflight/);
  assert.ok(start.indexOf('/preflight') < start.indexOf('PUBLIC_URL='),'preflight must happen before public tunnel creation');
  assert.ok(start.indexOf('/preflight') < start.indexOf('send-link.mjs'),'preflight must happen before email delivery');
});

test('phone UI confirms both painted frames and completed input actions',async()=>{
  const [gateway,page]=await Promise.all([read('src/self-hosted-gateway.mjs'),read('public/index.html')]);
  assert.match(gateway,/waitForAck: true/);
  assert.match(gateway,/type: 'inputAck'/);
  assert.match(page,/type:'frameAck'/);
  assert.match(page,/function sendAction\(/);
  assert.match(page,/function finishAction\(/);
  assert.match(page,/className='tap'/);
});

test('start delivers the same private URL by email and direct output',async()=>{
  const start=await read('scripts/start.sh');
  assert.match(start,/LOGIN_URL="\$\{PUBLIC_URL%\/\}\/\#token=\$TOKEN"/);
  assert.match(start,/send-link\.mjs" "\$LOGIN_URL"/);
  assert.match(start,/Direct phone link \(private and temporary\): \$LOGIN_URL/);
});

test('installer includes the shared core beside the installed package',async()=>{
  const installer=await read('scripts/install.sh');
  assert.match(installer,/PACKAGE_ROOT\/\.\.\/core/);
  assert.match(installer,/SKILL_ROOT\/core/);
});
