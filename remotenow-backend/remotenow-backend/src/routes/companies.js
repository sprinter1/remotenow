const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

// ── GET /api/companies ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, u.name AS owner_name,
        (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id AND j.is_active = TRUE)::INT AS active_jobs
      FROM companies c
      JOIN users u ON u.id = c.owner_id
      ORDER BY active_jobs DESC, c.name
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/companies/:slug ───────────────────────────────
router.get('/:slug', async (req, res) => {
  try {
    const { rows: [company] } = await pool.query(`
      SELECT c.*,
        (SELECT JSON_AGG(j ORDER BY j.created_at DESC)
         FROM (
           SELECT j.id, j.title, j.slug, j.category, j.job_type,
                  j.experience, j.salary_min, j.salary_max, j.region, j.created_at
           FROM jobs j
           WHERE j.company_id = c.id AND j.is_active = TRUE
           LIMIT 10
         ) j
        ) AS jobs
      FROM companies c WHERE c.slug = $1
    `, [req.params.slug]);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/companies ────────────────────────────────────
router.post('/', requireAuth, requireRole('employer','admin'), async (req, res) => {
  const { name, website, description, size, industry, hq_location, logo_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name is required' });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
  try {
    const { rows: [company] } = await pool.query(`
      INSERT INTO companies (owner_id, name, slug, website, description, size, industry, hq_location, logo_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [req.user.id, name, slug, website, description, size, industry, hq_location, logo_url]);
    res.status(201).json(company);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
