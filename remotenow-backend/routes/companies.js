// routes/companies.js
const express = require('express');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/companies
router.get('/', (req, res) => {
  const companies = db.prepare(`
    SELECT c.*, u.name AS owner_name,
      (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id AND j.is_active = 1) AS open_jobs
    FROM companies c JOIN users u ON u.id = c.owner_id
    ORDER BY open_jobs DESC
  `).all();
  res.json(companies);
});

// GET /api/companies/:slug
router.get('/:slug', (req, res) => {
  const company = db.prepare(`
    SELECT c.*, u.name AS owner_name FROM companies c JOIN users u ON u.id = c.owner_id
    WHERE c.slug = ?
  `).get(req.params.slug);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const jobs = db.prepare(`
    SELECT id, title, slug, category, type, level, salary_min, salary_max,
           location_type, is_featured, created_at
    FROM jobs WHERE company_id = ? AND is_active = 1 ORDER BY created_at DESC
  `).all(company.id);

  res.json({ ...company, jobs });
});

// POST /api/companies
router.post('/', requireAuth, requireRole('employer','admin'), (req, res) => {
  const { name, website, description, size, industry, founded } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
             + '-' + Date.now();
  const result = db.prepare(`
    INSERT INTO companies (owner_id, name, slug, website, description, size, industry, founded)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, name, slug, website, description, size, industry, founded);

  res.status(201).json(db.prepare('SELECT * FROM companies WHERE id=?').get(result.lastInsertRowid));
});

module.exports = router;
