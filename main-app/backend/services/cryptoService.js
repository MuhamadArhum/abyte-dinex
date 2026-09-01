// AES-256-GCM symmetric encryption for sensitive values stored in DB.
// Key derived from ENCRYPTION_KEY env var (preferred) or JWT_SECRET (fallback).
// Stored format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
// Plain-text values (without prefix) are returned as-is for backward compatibility.

const crypto = require('crypto');

const ALGORITHM  = 'aes-256-gcm';
const ENC_PREFIX = 'enc:v1:';

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) throw new Error('ENCRYPTION_KEY env variable is required for token encryption');
  return crypto.createHash('sha256').update(raw).digest(); // always 32 bytes
}

function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext; // already encrypted
  const key    = getKey();
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(value) {
  if (!value || !value.startsWith(ENC_PREFIX)) return value; // plain text — backward compat
  const key   = getKey();
  const parts = value.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) return value;
  const [ivHex, tagHex, encHex] = parts;
  const iv       = Buffer.from(ivHex, 'hex');
  const tag      = Buffer.from(tagHex, 'hex');
  const encBuf   = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8');
}

function isEncrypted(value) {
  return !!(value && value.startsWith(ENC_PREFIX));
}

module.exports = { encrypt, decrypt, isEncrypted };
