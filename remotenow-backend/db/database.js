// db/database.js — initializes SQLite and creates all tables
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'remotenow.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── CREATE TABLES ──────────────────────────────────────────────

db.exec(`
  -- Users (job seekers & employers)
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'seeker'   CHECK(role IN ('seeker','employer','admin')),
    avatar_url  TEXT,
    bio         TEXT,
    location    TEXT,
    website     TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Companies
  CREATE TABLE IF NOT EXISTS companies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    slug        TEXT    NOT NULL UNIQUE,
    logo_url    TEXT,
    website     TEXT,
    description TEXT,
    size        TEXT    CHECK(size IN ('1-10','11-50','51-200','201-500','500+')),
    industry    TEXT,
    founded     INTEGER,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Jobs
  CREATE TABLE IF NOT EXISTS jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title         TEXT    NOT NULL,
    slug          TEXT    NOT NULL UNIQUE,
    description   TEXT    NOT NULL,
    requirements  TEXT,
    benefits      TEXT,
    category      TEXT    NOT NULL,
    type          TEXT    NOT NULL CHECK(type IN ('Full-Time','Part-Time','Contract','Freelance')),
    level         TEXT    CHECK(level IN ('Junior','Mid-Level','Senior','Lead','Director+')),
    salary_min    INTEGER,
    salary_max    INTEGER,
    salary_currency TEXT  DEFAULT 'USD',
    location_type TEXT    NOT NULL DEFAULT 'Worldwide' CHECK(location_type IN ('Worldwide','USA Only','Europe','APAC','LATAM','Other')),
    timezone      TEXT,
    is_featured   INTEGER NOT NULL DEFAULT 0,
    is_active     INTEGER NOT NULL DEFAULT 1,
    apply_url     TEXT,
    views         INTEGER NOT NULL DEFAULT 0,
    expires_at    TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Job Tags (many-to-many)
  CREATE TABLE IF NOT EXISTS job_tags (
    job_id  INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    tag     TEXT    NOT NULL,
    PRIMARY KEY (job_id, tag)
  );

  -- Saved Jobs (bookmarks)
  CREATE TABLE IF NOT EXISTS saved_jobs (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id     INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    saved_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, job_id)
  );

  -- Applications
  CREATE TABLE IF NOT EXISTS applications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cover_letter TEXT,
    resume_url  TEXT,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','interview','offer','rejected')),
    applied_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(job_id, user_id)
  );

  -- Newsletter subscribers
  CREATE TABLE IF NOT EXISTS subscribers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT    NOT NULL UNIQUE,
    categories TEXT,
    active     INTEGER NOT NULL DEFAULT 1,
    joined_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
