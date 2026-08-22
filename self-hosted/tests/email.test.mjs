import assert from 'node:assert/strict';
import {SMTPServer} from 'smtp-server';
import test from 'node:test';
import {sendRelayEmail, sendTestEmail} from '../src/email.mjs';

const startSmtp = async () => {
  const messages = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH'],
    onData(stream, _session, callback) {
      let body = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => { body += chunk; });
      stream.on('end', () => { messages.push(body); callback(); });
    },
  });
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve());
  });
  return {server, messages, port: server.server.address().port};
};

test('email sender delivers ToolArks-branded temporary link', async () => {
  const smtp = await startSmtp();
  try {
    const env = {
      REMOTE_RELAY_SMTP_HOST: '127.0.0.1',
      REMOTE_RELAY_SMTP_PORT: String(smtp.port),
      REMOTE_RELAY_SMTP_FROM: 'relay@example.test',
      REMOTE_RELAY_NOTIFY_TO: 'founder@example.test',
      REMOTE_RELAY_SMTP_REQUIRE_TLS: '0',
      REMOTE_RELAY_SMTP_ALLOW_INVALID_CERT: '1',
    };
    await sendRelayEmail({env, link: 'https://relay.example.test/#token=abc123'});
    assert.equal(smtp.messages.length, 1);
    assert.match(smtp.messages[0], /ToolArks/);
    assert.match(smtp.messages[0], /https:\/\/relay\.example\.test\/#token=abc123/);
    assert.match(smtp.messages[0], /founder@example\.test/);
  } finally {
    await new Promise((resolve) => smtp.server.close(resolve));
  }
});

test('email test rejects a non-HTTPS link and can send a configuration test', async () => {
  const smtp = await startSmtp();
  try {
    const env = {
      REMOTE_RELAY_SMTP_HOST: '127.0.0.1',
      REMOTE_RELAY_SMTP_PORT: String(smtp.port),
      REMOTE_RELAY_SMTP_FROM: 'relay@example.test',
      REMOTE_RELAY_NOTIFY_TO: 'founder@example.test',
      REMOTE_RELAY_SMTP_REQUIRE_TLS: '0',
      REMOTE_RELAY_SMTP_ALLOW_INVALID_CERT: '1',
    };
    await assert.rejects(() => sendRelayEmail({env, link: 'http://unsafe.example.test/#token=x'}), /HTTPS/);
    await sendTestEmail({env});
    assert.equal(smtp.messages.length, 1);
    assert.match(smtp.messages[0], /self-hosted email test/);
  } finally {
    await new Promise((resolve) => smtp.server.close(resolve));
  }
});
