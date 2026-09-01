// storageService.js - Unified object storage layer
//
// Adapters (selected by STORAGE_PROVIDER env var):
//   s3    – Amazon S3
//   r2    – Cloudflare R2 (S3-compatible)
//   minio – Self-hosted MinIO (S3-compatible)
//   local – Local disk (default, backward-compatible)
//
// Required env vars per provider:
//   s3    : STORAGE_PROVIDER=s3   AWS_ACCESS_KEY_ID  AWS_SECRET_ACCESS_KEY  AWS_REGION  STORAGE_BUCKET
//   r2    : STORAGE_PROVIDER=r2   AWS_ACCESS_KEY_ID  AWS_SECRET_ACCESS_KEY  CLOUDFLARE_ACCOUNT_ID  STORAGE_BUCKET
//   minio : STORAGE_PROVIDER=minio  AWS_ACCESS_KEY_ID  AWS_SECRET_ACCESS_KEY  MINIO_ENDPOINT  STORAGE_BUCKET
//   local : (no additional vars needed)

const path = require('path');
const fs   = require('fs');
const fsp  = fs.promises;
const logger = require('../config/logger');

const PROVIDER = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
const BUCKET   = process.env.STORAGE_BUCKET || 'abyte-uploads';

// ── S3 / R2 / MinIO client (lazy-loaded) ─────────────────────
let _s3Client = null;
function getS3Client() {
  if (_s3Client) return _s3Client;
  const { S3Client } = require('@aws-sdk/client-s3');

  let endpoint;
  if (PROVIDER === 'r2') {
    endpoint = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  } else if (PROVIDER === 'minio') {
    endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  }

  _s3Client = new S3Client({
    region:      process.env.AWS_REGION || 'auto',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    ...(endpoint && { endpoint, forcePathStyle: PROVIDER === 'minio' }),
  });
  return _s3Client;
}

// ── Upload ────────────────────────────────────────────────────
async function upload({ key, buffer, mimetype }) {
  if (PROVIDER === 'local') {
    return _localUpload(key, buffer);
  }
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await getS3Client().send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: mimetype || 'application/octet-stream',
  }));
  logger.info('[Storage] Uploaded to cloud', { provider: PROVIDER, key });
  return { key, provider: PROVIDER };
}

// ── Generate signed URL (60-minute expiry by default) ─────────
async function getSignedUrl(key, expiresIn = 3600) {
  if (PROVIDER === 'local') {
    return `/uploads/${path.basename(key)}`;
  }
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl: awsGetSignedUrl } = require('@aws-sdk/s3-request-presigner');
  return awsGetSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );
}

// ── Delete ────────────────────────────────────────────────────
async function remove(key) {
  if (PROVIDER === 'local') {
    const fullPath = path.join(__dirname, '../uploads', path.basename(key));
    await fsp.unlink(fullPath).catch(() => {});
    return;
  }
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  await getS3Client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// ── Local fallback ────────────────────────────────────────────
async function _localUpload(key, buffer) {
  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filename = path.basename(key);
  await fsp.writeFile(path.join(uploadsDir, filename), buffer);
  return { key, provider: 'local' };
}

// ── Public URL (for cloud providers that allow public buckets) ─
function getPublicUrl(key) {
  if (PROVIDER === 'local') return `/uploads/${path.basename(key)}`;
  if (PROVIDER === 's3') return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  if (PROVIDER === 'r2') return `https://${BUCKET}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  if (PROVIDER === 'minio') return `${process.env.MINIO_ENDPOINT || 'http://localhost:9000'}/${BUCKET}/${key}`;
  return `/uploads/${path.basename(key)}`;
}

module.exports = { upload, getSignedUrl, remove, getPublicUrl, PROVIDER };
