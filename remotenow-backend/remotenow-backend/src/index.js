require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes      = require('./routes/auth');
const jobsRoutes      = require('./routes/jobs');
const companiesRoutes = require('./routes/companies');

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request logger (dev only) ──────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()}  ${req.method}  ${req.originalUrl}`);
    next();
  });
}

// ── Health check ───────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/jobs',      jobsRoutes);
app.use('/api/companies', companiesRoutes);

// ── 404 ────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ───────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('');
  console.log('🚀  RemoteNow API running!');
  console.log(`📡  http://localhost:${PORT}`);
  console.log(`🌍  ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('📋  Endpoints:');
  console.log(`    POST   /api/auth/register`);
  console.log(`    POST   /api/auth/login`);
  console.log(`    GET    /api/auth/me`);
  console.log(`    GET    /api/jobs?search=&category=&type=&region=&page=`);
  console.log(`    GET    /api/jobs/:slug`);
  console.log(`    POST   /api/jobs           (employer)`);
  console.log(`    PATCH  /api/jobs/:id       (employer)`);
  console.log(`    DELETE /api/jobs/:id       (employer)`);
  console.log(`    POST   /api/jobs/:id/save  (auth)`);
  console.log(`    GET    /api/jobs/saved/list (auth)`);
  console.log(`    GET    /api/companies`);
  console.log(`    GET    /api/companies/:slug`);
  console.log(`    POST   /api/companies      (employer)`);
  console.log('');
});
