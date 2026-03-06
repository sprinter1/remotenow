# 🚀 RemoteNow — Backend API

Full REST API for the RemoteNow job board. Built with **Node.js + Express + PostgreSQL**.

---

## 📦 Stack

| Layer      | Technology          |
|------------|---------------------|
| Runtime    | Node.js 18+         |
| Framework  | Express 4           |
| Database   | PostgreSQL 14+      |
| Auth       | JWT (jsonwebtoken)  |
| Passwords  | bcryptjs            |
| Validation | express-validator   |

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- PostgreSQL running locally (or use a cloud DB like Supabase / Railway)

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env and fill in your DB credentials and JWT secret
```

### 4. Create the database
```bash
# In psql:
CREATE DATABASE remotenow;
```

### 5. Set up the schema
```bash
npm run db:setup
```

### 6. Seed with sample data
```bash
npm run db:seed
```

### 7. Start the server
```bash
npm run dev      # Development (with auto-reload via nodemon)
npm start        # Production
```

Server starts on **http://localhost:4000**

---

## 🔑 API Reference

### Auth

| Method | Endpoint             | Description         | Auth     |
|--------|----------------------|---------------------|----------|
| POST   | `/api/auth/register` | Create account      | ❌        |
| POST   | `/api/auth/login`    | Login               | ❌        |
| GET    | `/api/auth/me`       | Get my profile      | ✅ Bearer |
| PATCH  | `/api/auth/me`       | Update my profile   | ✅ Bearer |

### Jobs

| Method | Endpoint               | Description              | Auth           |
|--------|------------------------|--------------------------|----------------|
| GET    | `/api/jobs`            | List / search jobs       | Optional       |
| GET    | `/api/jobs/:slug`      | Get job details          | Optional       |
| POST   | `/api/jobs`            | Create job               | ✅ Employer    |
| PATCH  | `/api/jobs/:id`        | Update job               | ✅ Employer    |
| DELETE | `/api/jobs/:id`        | Delete job               | ✅ Employer    |
| POST   | `/api/jobs/:id/save`   | Save a job               | ✅ Any user    |
| DELETE | `/api/jobs/:id/save`   | Unsave a job             | ✅ Any user    |
| GET    | `/api/jobs/saved/list` | My saved jobs            | ✅ Any user    |

#### Job Search Query Params
```
GET /api/jobs?search=react&category=Engineering&type=Full-Time&experience=Senior&region=Worldwide&salary_min=100000&featured=true&sort=recent&page=1&limit=20
```

### Companies

| Method | Endpoint                | Description          | Auth        |
|--------|-------------------------|----------------------|-------------|
| GET    | `/api/companies`        | List all companies   | ❌           |
| GET    | `/api/companies/:slug`  | Company + their jobs | ❌           |
| POST   | `/api/companies`        | Create company       | ✅ Employer  |

---

## 🧪 Example Requests

### Register
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123","name":"Your Name","role":"jobseeker"}'
```

### Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@example.com","password":"password123"}'
```

### Search Jobs
```bash
curl "http://localhost:4000/api/jobs?search=react&category=Engineering"
```

### Post a Job (as employer)
```bash
curl -X POST http://localhost:4000/api/jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "YOUR_COMPANY_UUID",
    "title": "Senior React Developer",
    "description": "We are looking for...",
    "category": "Engineering",
    "job_type": "Full-Time",
    "experience": "Senior",
    "salary_min": 120000,
    "salary_max": 160000,
    "region": "Worldwide",
    "tags": ["React", "TypeScript", "GraphQL"]
  }'
```

---

## 🗄️ Database Schema

```
users          → id, email, password, name, role, bio, avatar_url
companies      → id, owner_id, name, slug, description, size, industry
jobs           → id, company_id, title, slug, description, category, job_type, experience, salary_*
job_tags       → job_id, tag
saved_jobs     → user_id, job_id
applications   → id, job_id, user_id, status
```

---

## 🚢 Deploy to Production

### Option A — Railway (easiest)
1. Push code to GitHub
2. Connect repo to [Railway](https://railway.app)
3. Add a PostgreSQL plugin
4. Set environment variables
5. Done ✅

### Option B — Render
1. Create a Web Service on [Render](https://render.com)
2. Add a free PostgreSQL database
3. Set env vars, deploy

---

## 🔐 Test Accounts (after seeding)

| Role     | Email                  | Password    |
|----------|------------------------|-------------|
| Admin    | admin@remotenow.io     | password123 |
| Employer | hr@stripe.com          | password123 |
| Seeker   | alex@example.com       | password123 |
