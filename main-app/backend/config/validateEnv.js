const REQUIRED = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
];

const INSECURE_JWT_VALUES = [
  'your-super-secret-jwt-key-change-in-production',
  'secret',
  'changeme',
  'jwt_secret',
];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[startup] Copy .env.example to .env and fill in all values.');
    process.exit(1);
  }

  const OPTIONAL_WARN = ['REDIS_URL', 'EMAIL_HOST', 'EMAIL_USER'];
  OPTIONAL_WARN.forEach((key) => {
    if (!process.env[key]) console.warn(`[startup] Warning: ${key} is not set — email/queue features will be disabled.`);
  });

  if (process.env.NODE_ENV === 'production') {
    const jwt = process.env.JWT_SECRET;
    if (INSECURE_JWT_VALUES.includes(jwt) || jwt.length < 32) {
      console.error('[startup] JWT_SECRET is insecure. Generate one with:');
      console.error('  node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
      process.exit(1);
    }
  }
}

module.exports = { validateEnv };
