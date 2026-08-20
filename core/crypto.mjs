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
  // Web Crypto appends the 16-byte GCM authentication tag to the ciphertext.
  // Use the same envelope so the browser viewer and Node client can decrypt
  // each other's messages without protocol-specific transformations.
  const authenticatedCiphertext = Buffer.concat([ciphertext, cipher.getAuthTag()]);
  return JSON.stringify({v: 1, iv: iv.toString('base64url'), data: authenticatedCiphertext.toString('base64url')});
}

export function decryptJson(key, envelope) {
  const parsed = typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
  if (parsed.v !== 1) throw new Error('Unsupported encrypted envelope.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'base64url'));
  const payload = Buffer.from(parsed.data, 'base64url');
  const ciphertext = parsed.tag ? payload : payload.subarray(0, -16);
  const tag = parsed.tag ? Buffer.from(parsed.tag, 'base64url') : payload.subarray(-16);
  if (tag.length !== 16) throw new Error('Invalid encrypted envelope.');
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}
