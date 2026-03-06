// routes/auth.js — Register, Login, Profile
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { email, password, name, role = 'seeker' } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ error: 'email, password and name are required' });
  if (!['seeker','employer'].includes(role))
    return res.status(400).json({ error: 'role must be seeker or employer' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)'
  ).run(email, hashed, name, role);

  const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  const { password: _, ...safe } = user;
  res.json({ token: signToken(safe), user: safe });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, email, name, role, avatar_url, bio, location, website, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// PATCH /api/auth/me
router.patch('/me', requireAuth, (req, res) => {
  const { name, bio, location, website, avatar_url } = req.body;
  db.prepare(
    'UPDATE users SET name=COALESCE(?,name), bio=COALESCE(?,bio), location=COALESCE(?,location), website=COALESCE(?,website), avatar_url=COALESCE(?,avatar_url), updated_at=datetime("now") WHERE id=?'
  ).run(name, bio, location, website, avatar_url, req.user.id);
  const user = db.prepare('SELECT id,email,name,role,bio,location,website,avatar_url FROM users WHERE id=?').get(req.user.id);
  res.json(user);
});

module.exports = router;
