import { Router } from 'express';
import { createUser, findUserByEmail } from '../store.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../services/security.js';
import { config } from '../config.js';

function slugify(value) {
  return `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
}

export function registerAuthRoutes(app) {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      if (config.demoMode) return res.status(409).json({ error: 'Registration is disabled in DEMO_MODE. Use DEMO_MODE=false with MongoDB.' });
      const { name, email, password, merchantName } = req.body || {};
      if (!name || !email || !merchantName || typeof password !== 'string' || password.length < 10) return res.status(400).json({ error: 'Name, email, merchant name and a password of at least 10 characters are required.' });
      const existing = await findUserByEmail(email);
      if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
      const passwordHash = await hashPassword(password);
      const { user, merchant } = await createUser({ name, email, passwordHash, merchantName, slug: slugify(merchantName) });
      return res.status(201).json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role }, merchant: { id: merchant._id, name: merchant.name } });
    } catch (error) { return next(error); }
  });

  router.post('/login', async (req, res, next) => {
    try {
      if (config.demoMode) return res.status(409).json({ error: 'Login is disabled in DEMO_MODE. Set DEMO_MODE=false with MongoDB for real accounts.' });
      const { email, password } = req.body || {};
      const user = await findUserByEmail(email || '');
      if (!user || !user.isActive || !(await verifyPassword(password || '', user.passwordHash))) return res.status(401).json({ error: 'Invalid credentials.' });
      user.lastLoginAt = new Date();
      await user.save();
      return res.json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role }, merchantId: user.merchantId });
    } catch (error) { return next(error); }
  });

  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      if (config.demoMode) return res.json({ user: { id: 'demo-user', name: 'Demo Owner', email: 'owner@demo.local', role: 'owner' }, merchantId: 'demo-merchant' });
      const user = await findUserByEmail(req.auth?.email || '');
      return res.json({ authenticated: true, claims: req.auth, user: user ? { id: user._id, name: user.name, email: user.email, role: user.role } : null });
    } catch (error) { return next(error); }
  });

  app.use('/api/auth', router);
}
