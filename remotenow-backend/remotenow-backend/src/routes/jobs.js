const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

// ── Slugify helper ─────────────────────────────────────────
const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ── GET /api/jobs ──────────────────────────────────────────
// Public — supports: search, category, type, experience, region, salary_min, featured, page, limit
router.get('/', optionalAuth, async (req, res) => {
  const {
    search, category, type, experience, region,
    salary_min, featured, page = 1, limit = 20, sort = 'recent'
  } = req.query;

  const values = [];
  const conditions = ['j.is_active = TRUE'];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(j.title ILIKE $${values.length} OR c.name ILIKE $${values.length})`);
  }
  if (category)   { values.push(category);   conditions.push(`j.category = $${values.length}`); }
  if (type)       { values.push(type);        conditions.push(`j.job_type = $${values.length}`); }
  if (experience) { values.push(experience);  conditions.push(`j.experience = $${values.length}`); }
  if (region)     { values.push(region);      conditions.push(`j.region = $${values.length}`); }
  if (salary_min) { values.push(Number(salary_min)); conditions.push(`j.salary_max >= $${values.length}`); }
  if (featured === 'true') conditions.push('j.is_featured = TRUE');

  const sortMap = {
    recent: 'j.created_at DESC',
    salary: 'j.salary_max DESC NULLS LAST',
    featured: 'j.is_featured DESC, j.created_at DESC',
  };
  const orderBy = sortMap[sort] || sortMap.recent;

  const offset = (Number(page) - 1) * Number(limit);
  values.push(Number(limit), offset);

  const WHERE = conditions.join(' AND ');

  try {
    const { rows: jobs } = await pool.query(`
      SELECT
        j.id, j.title, j.slug, j.category, j.job_type, j.experience,
        j.salary_min, j.salary_max, j.salary_currency,
        j.region, j.is_featured, j.views, j.created_at,
        c.id AS company_id, c.name AS company_name, c.slug AS company_slug, c.logo_url,
        COALESCE(
          (SELECT JSON_AGG(tag ORDER BY tag) FROM job_tags WHERE job_id = j.id),
          '[]'
        ) AS tags
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      WHERE ${WHERE}
      ORDER BY ${orderBy}
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `, values);

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*) AS total FROM jobs j JOIN companies c ON c.id = j.company_id WHERE ${WHERE}`,
      values.slice(0, -2)
    );

    res.json({
      jobs,
      pagination: {
        total: Number(total),
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(Number(total) / Number(limit)),
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/jobs/:slug ────────────────────────────────────
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    // Increment view count
    await pool.query('UPDATE jobs SET views = views + 1 WHERE slug = $1', [req.params.slug]);

    const { rows: [job] } = await pool.query(`
      SELECT
        j.*,
        c.name AS company_name, c.slug AS company_slug, c.logo_url,
        c.website AS company_website, c.description AS company_description,
        c.size AS company_size, c.industry AS company_industry,
        c.hq_location AS company_hq,
        COALESCE(
          (SELECT JSON_AGG(tag ORDER BY tag) FROM job_tags WHERE job_id = j.id),
          '[]'
        ) AS tags
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      WHERE j.slug = $1
    `, [req.params.slug]);

    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Is it saved by the current user?
    if (req.user) {
      const { rows } = await pool.query(
        'SELECT 1 FROM saved_jobs WHERE user_id=$1 AND job_id=$2',
        [req.user.id, job.id]
      );
      job.is_saved = rows.length > 0;
    }

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/jobs ─────────────────────────────────────────
router.post('/', requireAuth, requireRole('employer','admin'), [
  body('title').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('category').notEmpty(),
  body('job_type').isIn(['Full-Time','Part-Time','Contract','Freelance']),
  body('experience').isIn(['Junior','Mid-Level','Senior','Lead / Principal','Director+']),
  body('region').optional().trim(),
  body('salary_min').optional().isInt({ min: 0 }),
  body('salary_max').optional().isInt({ min: 0 }),
  body('tags').optional().isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const {
    title, description, requirements, category, job_type, experience,
    salary_min, salary_max, salary_currency = 'USD',
    region = 'Worldwide', apply_url, apply_email, tags = [], company_id
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify company ownership
    const { rows: [company] } = await client.query(
      'SELECT id FROM companies WHERE id = $1 AND owner_id = $2',
      [company_id, req.user.id]
    );
    if (!company && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not own this company' });
    }

    const baseSlug = slugify(title);
    let slug = `${baseSlug}-${Date.now()}`;

    const { rows: [job] } = await client.query(`
      INSERT INTO jobs
        (company_id, title, slug, description, requirements, category, job_type,
         experience, salary_min, salary_max, salary_currency, region, apply_url, apply_email)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [company_id, title, slug, description, requirements, category, job_type,
        experience, salary_min, salary_max, salary_currency, region, apply_url, apply_email]);

    for (const tag of tags.slice(0, 10)) {
      await client.query(
        'INSERT INTO job_tags (job_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [job.id, tag.trim()]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...job, tags });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── PATCH /api/jobs/:id ────────────────────────────────────
router.patch('/:id', requireAuth, requireRole('employer','admin'), async (req, res) => {
  const { title, description, requirements, category, job_type, experience,
          salary_min, salary_max, region, apply_url, apply_email, is_active, tags } = req.body;
  try {
    const { rows: [job] } = await pool.query(
      `UPDATE jobs SET
         title       = COALESCE($1, title),
         description = COALESCE($2, description),
         requirements= COALESCE($3, requirements),
         category    = COALESCE($4, category),
         job_type    = COALESCE($5, job_type),
         experience  = COALESCE($6, experience),
         salary_min  = COALESCE($7, salary_min),
         salary_max  = COALESCE($8, salary_max),
         region      = COALESCE($9, region),
         apply_url   = COALESCE($10, apply_url),
         apply_email = COALESCE($11, apply_email),
         is_active   = COALESCE($12, is_active)
       WHERE id = $13 RETURNING *`,
      [title, description, requirements, category, job_type, experience,
       salary_min, salary_max, region, apply_url, apply_email, is_active, req.params.id]
    );
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/jobs/:id ───────────────────────────────────
router.delete('/:id', requireAuth, requireRole('employer','admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Job not found' });
    res.json({ message: 'Job deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/jobs/:id/save ────────────────────────────────
router.post('/:id/save', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO saved_jobs (user_id, job_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.id]
    );
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/jobs/:id/save ──────────────────────────────
router.delete('/:id/save', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM saved_jobs WHERE user_id=$1 AND job_id=$2', [req.user.id, req.params.id]);
    res.json({ saved: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/jobs/saved/list ───────────────────────────────
router.get('/saved/list', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT j.id, j.title, j.slug, j.category, j.job_type, j.salary_min, j.salary_max,
             j.region, j.created_at, c.name AS company_name, c.logo_url, s.saved_at
      FROM saved_jobs s
      JOIN jobs j ON j.id = s.job_id
      JOIN companies c ON c.id = j.company_id
      WHERE s.user_id = $1
      ORDER BY s.saved_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
