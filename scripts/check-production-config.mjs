import 'dotenv/config';

const defaultAdminPasswordHash = '$2b$10$xVBmUPJph0jgqqkqnLIt8e.4EhwN4NYUj1wqEazquAsPWtEazLvDO';
const defaultJWTSecret = 'super_secret_jwt_key_for_indie_rock_map';
const expectedAppleClientID = 'com.catbeer.Catbeer-iOS';

const errors = [];
const requireValue = (name) => {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} is required.`);
  return value || '';
};

const adminPasswordHash = requireValue('ADMIN_PASSWORD_HASH');
const jwtSecret = requireValue('JWT_SECRET');
const userJWTSecret = requireValue('USER_JWT_SECRET');
const appleClientID = requireValue('APPLE_CLIENT_ID');
requireValue('DATABASE_PATH');

if (adminPasswordHash === defaultAdminPasswordHash) {
  errors.push('ADMIN_PASSWORD_HASH must not use the development fallback hash.');
}
if (!adminPasswordHash.startsWith('$2')) {
  errors.push('ADMIN_PASSWORD_HASH must be a bcrypt hash.');
}
if (jwtSecret === defaultJWTSecret || jwtSecret.length < 32) {
  errors.push('JWT_SECRET must be a unique secret of at least 32 characters.');
}
if (userJWTSecret === jwtSecret || userJWTSecret.length < 32) {
  errors.push('USER_JWT_SECRET must be a separate secret of at least 32 characters.');
}
if (appleClientID !== expectedAppleClientID) {
  errors.push(`APPLE_CLIENT_ID must match the iOS bundle identifier: ${expectedAppleClientID}.`);
}

if (errors.length) {
  console.error('Production configuration is not ready:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Production configuration check passed.');
