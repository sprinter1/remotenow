// server.js — RemoteNow API Server
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const authRoutes    = require('./routes/auth');
const jobRoutes     = require('./routes/jobs');
const companyRoutes = require('./routes/companies');
const { applicationsRouter, newsletterRouter } = require('./routes/applications');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ─────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString().split('T')[1].split('.')[0]}  ${req.method.padEnd(7)} ${req.path}`);
    next();
  });
}

// ── ROUTES ─────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/jobs',         jobRoutes);
app.use('/api/companies',    companyRoutes);
app.use('/api/applications', applicationsRouter);
app.use('/api/newsletter',   newsletterRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  RemoteNow API running on http://localhost:${PORT}`);
  console.log(`\n📋  Endpoints:`);
  console.log(`   POST  /api/auth/register`);
  console.log(`   POST  /api/auth/login`);
  console.log(`   GET   /api/auth/me`);
  console.log(`   GET   /api/jobs?q=&category=&type=&level=&location_type=&page=&limit=`);
  console.log(`   GET   /api/jobs/categories`);
  console.log(`   GET   /api/jobs/:slug`);
  console.log(`   POST  /api/jobs  (employer)`);
  console.log(`   POST  /api/jobs/:id/save  (seeker)`);
  console.log(`   GET   /api/companies`);
  console.log(`   GET   /api/companies/:slug`);
  console.log(`   POST  /api/applications`);
  console.log(`   GET   /api/applications/mine`);
  console.log(`   POST  /api/newsletter/subscribe\n`);
});
