# RemoteNow — Backend API

Full REST API for the RemoteNow remote job board, built with:
- **Node.js + Express** — fast, minimal server
- **SQLite (better-sqlite3)** — zero-config database, single file
- **JWT** — stateless authentication
- **bcryptjs** — password hashing

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
# Edit .env and set a strong JWT_SECRET

# 3. Seed the database with sample data
npm run seed

# 4. Start the server
npm run dev        # with auto-reload (nodemon)
# OR
npm start          # production
```

Server runs at **http://localhost:3000**

---

## 📁 Project Structure

```
remotenow/
├── server.js              # Entry point
├── .env.example           # Environment variables template
├── db/
│   ├── database.js        # SQLite init + all table schemas
│   ├── seed.js            # Sample data (companies, jobs, users)
│   └── remotenow.db       # Created automatically on first run
├── middleware/
│   └── auth.js            # JWT middleware
└── routes/
    ├── auth.js            # Register, login, profile
    ├── jobs.js            # Job CRUD + search + save
    ├── companies.js       # Company profiles
    └── applications.js    # Apply + manage + newsletter
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Get JWT token |
| GET | `/api/auth/me` | ✅ | Get profile |
| PATCH | `/api/auth/me` | ✅ | Update profile |

**Register example:**
```json
POST /api/auth/register
{
  "email": "dev@example.com",
  "password": "secret123",
  "name": "John Doe",
  "role": "seeker"   // or "employer"
}
```

---

### Jobs
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/jobs` | — | List + search + filter |
| GET | `/api/jobs/categories` | — | Category counts |
| GET | `/api/jobs/:slug` | — | Single job |
| POST | `/api/jobs` | employer | Create job |
| PATCH | `/api/jobs/:id` | employer | Update job |
| DELETE | `/api/jobs/:id` | employer | Delete job |
| POST | `/api/jobs/:id/save` | seeker | Toggle saved |
| GET | `/api/jobs/saved/me` | seeker | My saved jobs |

**Search & Filter query params:**
```
GET /api/jobs?q=react&category=Engineering&type=Full-Time&level=Senior&location_type=Worldwide&salary_min=100000&page=1&limit=20
```

---

### Companies
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/companies` | — | All companies |
| GET | `/api/companies/:slug` | — | Company + jobs |
| POST | `/api/companies` | employer | Create company |

---

### Applications
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/applications` | seeker | Apply to job |
| GET | `/api/applications/mine` | seeker | My applications |
| GET | `/api/applications/job/:id` | employer | Job's applicants |
| PATCH | `/api/applications/:id/status` | employer | Update status |

---

### Newsletter
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/newsletter/subscribe` | Subscribe |
| POST | `/api/newsletter/unsubscribe` | Unsubscribe |

---

## 🗄️ Database Schema

| Table | Description |
|-------|-------------|
| `users` | Job seekers, employers, admins |
| `companies` | Employer company profiles |
| `jobs` | Job listings |
| `job_tags` | Many-to-many tags per job |
| `saved_jobs` | Bookmarked jobs per user |
| `applications` | Job applications with status tracking |
| `subscribers` | Newsletter subscribers |

---

## 🧪 Test Credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@remotenow.com | admin123 |
| Employer (Stripe) | stripe@remotenow.com | employer1 |
| Seeker | alice@example.com | seeker123 |

---

## 🔗 Connect to the Frontend

In your `remotejobs.html`, replace the mock `JOBS` array with real API calls:

```javascript
// Fetch jobs from the API
const res = await fetch('http://localhost:3000/api/jobs?category=Engineering&limit=20');
const { data, meta } = await res.json();
```

---

## 📦 Deploy to Production

1. Use **Railway**, **Render**, or **Fly.io** for free Node.js hosting
2. Copy `remotenow.db` or use PostgreSQL for production (swap `better-sqlite3` for `pg`)
3. Set a strong `JWT_SECRET` environment variable
4. Set `NODE_ENV=production`
