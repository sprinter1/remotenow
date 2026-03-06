// routes/jobs.js — Full job board CRUD + search/filter/pagination
const express = require('express');
const db = require('../db/database');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: attach tags to a job or array of jobs
const attachTags = (jobs) => {
  const getTagsStmt = db.prepare('SELECT tag FROM job_tags WHERE job_id = ?');
  const arr = Array.isArray(jobs) ? jobs : [jobs];
  return arr.map(j => ({ ...j, tags: getTagsStmt.all(j.id).map(r => r.tag) }));
};

// ── GET /api/jobs  — list with search, filter, pagination ─────
router.get('/', optionalAuth, (req, res) => {
  const {
    q,              // keyword search
    category,       // Engineering, Design, …
    type,           // Full-Time, Part-Time, …
    level,          // Junior, Senior, …
    location_type,  // Worldwide, USA Only, …
    salary_min,     // minimum salary
    featured,       // 1 = featured only
    page = 1,
    limit = 20,
  } = req.query;

  const conditions = ['j.is_active = 1'];
  const params = [];

  if (q) {
    conditions.push('(j.title LIKE ? OR j.description LIKE ? OR c.name LIKE ? OR jt.tag LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (category)      { conditions.push('j.category = ?');      params.push(category); }
  if (type)          { conditions.push('j.type = ?');           params.push(type); }
  if (level)         { conditions.push('j.level = ?');          params.push(level); }
  if (location_type) { conditions.push('j.location_type = ?'); params.push(location_type); }
  if (salary_min)    { conditions.push('j.salary_max >= ?');    params.push(Number(salary_min)); }
  if (featured)      { conditions.push('j.is_featured = 1'); }

  const where = 'WHERE ' + conditions.join(' AND ');
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

  const rows = db.prepare(`
    SELECT DISTINCT j.*, c.name AS company_name, c.slug AS company_slug, c.logo_url, c.industry
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN job_tags jt ON jt.job_id = j.id
    ${where}
    ORDER BY j.is_featured DESC, j.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  const total = db.prepare(`
    SELECT COUNT(DISTINCT j.id) AS count
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN job_tags jt ON jt.job_id = j.id
    ${where}
  `).get(...params).count;

  // Increment view counts in background
  if (rows.length) {
    const ids = rows.map(r => r.id);
    db.prepare(`UPDATE jobs SET views = views + 1 WHERE id IN (${ids.map(()=>'?').join(',')})`).run(...ids);
  }

  res.json({
    data: attachTags(rows),
    meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
  });
});

// ── GET /api/jobs/categories — aggregated counts ─────────────
router.get('/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT category, COUNT(*) AS count
    FROM jobs WHERE is_active = 1
    GROUP BY category ORDER BY count DESC
  `).all();
  res.json(rows);
});

// ── GET /api/jobs/:slug ──────────────────────────────────────
router.get('/:slug', optionalAuth, (req, res) => {
  const job = db.prepare(`
    SELECT j.*, c.name AS company_name, c.slug AS company_slug,
           c.logo_url, c.website AS company_website, c.description AS company_description,
           c.size AS company_size, c.industry, c.founded
    FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE j.slug = ? AND j.is_active = 1
  `).get(req.params.slug);

  if (!job) return res.status(404).json({ error: 'Job not found' });

  db.prepare('UPDATE jobs SET views = views + 1 WHERE id = ?').run(job.id);

  const [jobWithTags] = attachTags([job]);

  // If authenticated, check if saved
  if (req.user) {
    const saved = db.prepare('SELECT 1 FROM saved_jobs WHERE user_id=? AND job_id=?').get(req.user.id, job.id);
    jobWithTags.is_saved = !!saved;
  }

  res.json(jobWithTags);
});

// ── POST /api/jobs — create (employer/admin only) ────────────
router.post('/', requireAuth, requireRole('employer','admin'), (req, res) => {
  const {
    company_id, title, description, requirements, benefits,
    category, type, level, salary_min, salary_max, salary_currency,
    location_type, timezone, apply_url, expires_at, tags = []
  } = req.body;

  if (!title || !description || !category || !type || !company_id)
    return res.status(400).json({ error: 'title, description, category, type, company_id required' });

  // Verify company belongs to user (unless admin)
  if (req.user.role !== 'admin') {
    const co = db.prepare('SELECT id FROM companies WHERE id=? AND owner_id=?').get(company_id, req.user.id);
    if (!co) return res.status(403).json({ error: 'Company not yours' });
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
             + '-' + company_id + '-' + Date.now();

  const result = db.prepare(`
    INSERT INTO jobs (company_id,title,slug,description,requirements,benefits,category,type,level,
      salary_min,salary_max,salary_currency,location_type,timezone,apply_url,expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(company_id,title,slug,description,requirements,benefits,category,type,level,
         salary_min,salary_max,salary_currency||'USD',location_type||'Worldwide',timezone,apply_url,expires_at);

  const jobId = result.lastInsertRowid;
  const insertTag = db.prepare('INSERT OR IGNORE INTO job_tags (job_id,tag) VALUES (?,?)');
  for (const tag of tags) insertTag.run(jobId, tag.trim());

  const [job] = attachTags([db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId)]);
  res.status(201).json(job);
});

// ── PATCH /api/jobs/:id — update ─────────────────────────────
router.patch('/:id', requireAuth, requireRole('employer','admin'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (req.user.role !== 'admin' && job.owner_id !== req.user.id)
    return res.status(403).json({ error: 'Not your job' });

  const { title,description,requirements,benefits,category,type,level,
          salary_min,salary_max,location_type,apply_url,expires_at,is_active,tags } = req.body;

  db.prepare(`
    UPDATE jobs SET
      title=COALESCE(?,title), description=COALESCE(?,description),
      requirements=COALESCE(?,requirements), benefits=COALESCE(?,benefits),
      category=COALESCE(?,category), type=COALESCE(?,type), level=COALESCE(?,level),
      salary_min=COALESCE(?,salary_min), salary_max=COALESCE(?,salary_max),
      location_type=COALESCE(?,location_type), apply_url=COALESCE(?,apply_url),
      expires_at=COALESCE(?,expires_at),
      is_active=COALESCE(?,is_active), updated_at=datetime('now')
    WHERE id=?
  `).run(title,description,requirements,benefits,category,type,level,
         salary_min,salary_max,location_type,apply_url,expires_at,is_active, req.params.id);

  if (tags) {
    db.prepare('DELETE FROM job_tags WHERE job_id=?').run(req.params.id);
    const ins = db.prepare('INSERT OR IGNORE INTO job_tags (job_id,tag) VALUES (?,?)');
    for (const t of tags) ins.run(req.params.id, t.trim());
  }

  const [updated] = attachTags([db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id)]);
  res.json(updated);
});

// ── DELETE /api/jobs/:id ──────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('employer','admin'), (req, res) => {
  const job = db.prepare('SELECT j.*, c.owner_id FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (req.user.role !== 'admin' && job.owner_id !== req.user.id)
    return res.status(403).json({ error: 'Not your job' });
  db.prepare('DELETE FROM jobs WHERE id=?').run(req.params.id);
  res.json({ message: 'Job deleted' });
});

// ── POST /api/jobs/:id/save — toggle saved ───────────────────
router.post('/:id/save', requireAuth, (req, res) => {
  const jobId = Number(req.params.id);
  const exists = db.prepare('SELECT 1 FROM saved_jobs WHERE user_id=? AND job_id=?').get(req.user.id, jobId);
  if (exists) {
    db.prepare('DELETE FROM saved_jobs WHERE user_id=? AND job_id=?').run(req.user.id, jobId);
    res.json({ saved: false });
  } else {
    db.prepare('INSERT INTO saved_jobs (user_id,job_id) VALUES (?,?)').run(req.user.id, jobId);
    res.json({ saved: true });
  }
});

// ── GET /api/jobs/saved/me ────────────────────────────────────
router.get('/saved/me', requireAuth, (req, res) => {
  const jobs = db.prepare(`
    SELECT j.*, c.name AS company_name, c.slug AS company_slug, c.logo_url
    FROM saved_jobs sj
    JOIN jobs j ON j.id = sj.job_id
    JOIN companies c ON c.id = j.company_id
    WHERE sj.user_id = ?
    ORDER BY sj.saved_at DESC
  `).all(req.user.id);
  res.json(attachTags(jobs));
});

module.exports = router;
