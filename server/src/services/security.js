import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

function encryptionKey() {
  if (!config.encryptionKey) throw new Error('ENCRYPTION_KEY must be configured in production.');
  return crypto.createHash('sha256').update(config.encryptionKey).digest();
}

export function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptSecret(value) {
  const [iv, tag, ciphertext] = String(value).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

export const hashPassword = (password) => bcrypt.hash(password, 12);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);
export const signToken = (user) => jwt.sign({ sub: user._id.toString(), merchantId: user.merchantId.toString(), role: user.role, email: user.email }, config.jwtSecret, { issuer: 'razcodepay', expiresIn: '1h' });
export const verifyToken = (token) => jwt.verify(token, config.jwtSecret, { issuer: 'razcodepay' });

export function requireAuth(req, res, next) {
  if (config.demoMode) return next();
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });
  try { req.auth = verifyToken(header.slice(7)); return next(); } catch { return res.status(401).json({ error: 'Invalid or expired access token.' }); }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (config.demoMode || roles.includes(req.auth?.role)) return next();
    return res.status(403).json({ error: 'Insufficient permissions.' });
  };
}
