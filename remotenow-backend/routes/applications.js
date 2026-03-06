// routes/applications.js
const express = require('express');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// POST /api/applications — apply to a job
router.post('/', requireAuth, requireRole('seeker'), (req, res) => {
  const { job_id, cover_letter, resume_url } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id is required' });

  const job = db.prepare('SELECT id FROM jobs WHERE id=? AND is_active=1').get(job_id);
  if (!job) return res.status(404).json({ error: 'Job not found or closed' });

  const existing = db.prepare('SELECT id FROM applications WHERE job_id=? AND user_id=?').get(job_id, req.user.id);
  if (existing) return res.status(409).json({ error: 'Already applied' });

  const result = db.prepare(`
    INSERT INTO applications (job_id, user_id, cover_letter, resume_url)
    VALUES (?, ?, ?, ?)
  `).run(job_id, req.user.id, cover_letter, resume_url);

  res.status(201).json(db.prepare('SELECT * FROM applications WHERE id=?').get(result.lastInsertRowid));
});

// GET /api/applications/mine — seeker's applications
router.get('/mine', requireAuth, requireRole('seeker'), (req, res) => {
  const apps = db.prepare(`
    SELECT a.*, j.title AS job_title, j.slug AS job_slug, c.name AS company_name
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    JOIN companies c ON c.id = j.company_id
    WHERE a.user_id = ?
    ORDER BY a.applied_at DESC
  `).all(req.user.id);
  res.json(apps);
});

// GET /api/applications/job/:jobId — employer sees applicants
router.get('/job/:jobId', requireAuth, requireRole('employer','admin'), (req, res) => {
  // Verify employer owns the job
  if (req.user.role !== 'admin') {
    const owns = db.prepare(`
      SELECT 1 FROM jobs j JOIN companies c ON c.id=j.company_id
      WHERE j.id=? AND c.owner_id=?
    `).get(req.params.jobId, req.user.id);
    if (!owns) return res.status(403).json({ error: 'Not your job' });
  }

  const apps = db.prepare(`
    SELECT a.*, u.name AS applicant_name, u.email AS applicant_email,
           u.bio, u.location
    FROM applications a JOIN users u ON u.id = a.user_id
    WHERE a.job_id = ?
    ORDER BY a.applied_at DESC
  `).all(req.params.jobId);
  res.json(apps);
});

// PATCH /api/applications/:id/status — update status
router.patch('/:id/status', requireAuth, requireRole('employer','admin'), (req, res) => {
  const { status } = req.body;
  const valid = ['pending','reviewed','interview','offer','rejected'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE applications SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ message: 'Status updated', status });
});

module.exports = router;


// ─── NEWSLETTER ────────────────────────────────────────────────
// routes/newsletter.js
const newsletterRouter = express.Router();

newsletterRouter.post('/subscribe', (req, res) => {
  const { email, categories } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const existing = db.prepare('SELECT id, active FROM subscribers WHERE email=?').get(email);
  if (existing) {
    if (existing.active) return res.status(409).json({ error: 'Already subscribed' });
    db.prepare('UPDATE subscribers SET active=1, categories=? WHERE email=?').run(categories, email);
    return res.json({ message: 'Resubscribed!' });
  }
  db.prepare('INSERT INTO subscribers (email, categories) VALUES (?,?)').run(email, categories);
  res.status(201).json({ message: 'Subscribed! 🎉' });
});

newsletterRouter.post('/unsubscribe', (req, res) => {
  const { email } = req.body;
  db.prepare('UPDATE subscribers SET active=0 WHERE email=?').run(email);
  res.json({ message: 'Unsubscribed.' });
});

module.exports = { applicationsRouter: router, newsletterRouter };
