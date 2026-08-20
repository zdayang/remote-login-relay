import crypto from 'node:crypto';

export function randomBase64Url(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function deriveSessionKey(pairingSecret, sessionId) {
  return crypto.hkdfSync('sha256', Buffer.from(pairingSecret, 'base64url'), Buffer.from(sessionId), Buffer.from('toolarks-remote-login-relay-v1'), 32);
}

export function encryptJson(key, value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return JSON.stringify({v: 1, iv: iv.toString('base64url'), data: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url')});
}

export function decryptJson(key, envelope) {
  const parsed = typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
  if (parsed.v !== 1) throw new Error('Unsupported encrypted envelope.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(parsed.data, 'base64url')), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}
