const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// Helper: sign token
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('role').optional().isIn(['jobseeker','employer']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password, name, role = 'jobseeker' } = req.body;
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (email, password, name, role) VALUES ($1,$2,$3,$4) RETURNING id,email,name,role,created_at`,
      [email, hash, name, role]
    );
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const { rows: [user] } = await pool.query(
      'SELECT id,email,name,role,password FROM users WHERE email = $1', [email]
    );
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { password: _, ...safeUser } = user;
    res.json({ token: signToken(safeUser), user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await pool.query(
      'SELECT id,email,name,role,avatar_url,bio,website,created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/auth/me ────────────────────────────────────
router.patch('/me', requireAuth, [
  body('name').optional().trim().notEmpty(),
  body('bio').optional().trim(),
  body('website').optional().isURL(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, bio, website, avatar_url } = req.body;
  try {
    const { rows: [user] } = await pool.query(
      `UPDATE users SET
         name       = COALESCE($1, name),
         bio        = COALESCE($2, bio),
         website    = COALESCE($3, website),
         avatar_url = COALESCE($4, avatar_url)
       WHERE id = $5
       RETURNING id,email,name,role,avatar_url,bio,website`,
      [name, bio, website, avatar_url, req.user.id]
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
