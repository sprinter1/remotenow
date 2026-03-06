require('dotenv').config();
const pool = require('./pool');

async function setup() {
  const client = await pool.connect();
  try {
    console.log('🔧 Setting up database schema...');

    await client.query(`
      -- ── EXTENSIONS ─────────────────────────────────────────
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      -- ── USERS ───────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email       VARCHAR(255) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        name        VARCHAR(100) NOT NULL,
        role        VARCHAR(20) NOT NULL DEFAULT 'jobseeker'
                      CHECK (role IN ('jobseeker','employer','admin')),
        avatar_url  TEXT,
        bio         TEXT,
        website     TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── COMPANIES ────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS companies (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        VARCHAR(150) NOT NULL,
        slug        VARCHAR(150) UNIQUE NOT NULL,
        logo_url    TEXT,
        website     TEXT,
        description TEXT,
        size        VARCHAR(50),   -- "1-10", "11-50", "51-200", etc.
        industry    VARCHAR(100),
        hq_location VARCHAR(100),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── JOBS ─────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS jobs (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        title         VARCHAR(200) NOT NULL,
        slug          VARCHAR(250) UNIQUE NOT NULL,
        description   TEXT NOT NULL,
        requirements  TEXT,
        category      VARCHAR(80) NOT NULL,
        job_type      VARCHAR(50) NOT NULL
                        CHECK (job_type IN ('Full-Time','Part-Time','Contract','Freelance')),
        experience    VARCHAR(50) NOT NULL
                        CHECK (experience IN ('Junior','Mid-Level','Senior','Lead / Principal','Director+')),
        salary_min    INTEGER,
        salary_max    INTEGER,
        salary_currency VARCHAR(10) DEFAULT 'USD',
        region        VARCHAR(100) NOT NULL DEFAULT 'Worldwide',
        apply_url     TEXT,
        apply_email   VARCHAR(255),
        is_featured   BOOLEAN NOT NULL DEFAULT FALSE,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        views         INTEGER NOT NULL DEFAULT 0,
        expires_at    TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── JOB TAGS ─────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS job_tags (
        job_id  UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        tag     VARCHAR(80) NOT NULL,
        PRIMARY KEY (job_id, tag)
      );

      -- ── SAVED JOBS ────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS saved_jobs (
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, job_id)
      );

      -- ── APPLICATIONS ─────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS applications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cover_note  TEXT,
        resume_url  TEXT,
        status      VARCHAR(30) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','reviewed','interview','rejected','hired')),
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(job_id, user_id)
      );

      -- ── INDEXES ───────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_jobs_category   ON jobs(category);
      CREATE INDEX IF NOT EXISTS idx_jobs_region     ON jobs(region);
      CREATE INDEX IF NOT EXISTS idx_jobs_job_type   ON jobs(job_type);
      CREATE INDEX IF NOT EXISTS idx_jobs_is_active  ON jobs(is_active);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_jobs_search
        ON jobs USING GIN (to_tsvector('english', title || ' ' || description));

      -- ── UPDATED_AT TRIGGER ────────────────────────────────────
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_jobs_updated_at  ON jobs;
      DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

      CREATE TRIGGER trg_jobs_updated_at
        BEFORE UPDATE ON jobs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

      CREATE TRIGGER trg_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    console.log('✅ Schema created successfully!');
    console.log('👉 Now run: npm run db:seed');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
