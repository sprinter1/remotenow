// db/seed.js — populates database with realistic sample data
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database');

console.log('🌱 Seeding database...');

// ── CLEAR EXISTING DATA ────────────────────────────────────────
db.exec(`
  DELETE FROM job_tags;
  DELETE FROM jobs;
  DELETE FROM companies;
  DELETE FROM users;
  DELETE FROM subscribers;
`);

// ── USERS ─────────────────────────────────────────────────────
const hashPw = (pw) => bcrypt.hashSync(pw, 10);

const insertUser = db.prepare(`
  INSERT INTO users (email, password, name, role, bio, location)
  VALUES (@email, @password, @name, @role, @bio, @location)
`);

const users = [
  { email:'admin@remotenow.com',  password: hashPw('admin123'),   name:'Admin',           role:'admin',    bio:'Platform admin', location:'Worldwide' },
  { email:'stripe@remotenow.com', password: hashPw('employer1'),  name:'Stripe Recruiter',role:'employer', bio:'Hiring at Stripe', location:'USA' },
  { email:'figma@remotenow.com',  password: hashPw('employer2'),  name:'Figma HR',        role:'employer', bio:'Hiring at Figma',  location:'USA' },
  { email:'vercel@remotenow.com', password: hashPw('employer3'),  name:'Vercel Team',     role:'employer', bio:'Hiring at Vercel', location:'Worldwide' },
  { email:'linear@remotenow.com', password: hashPw('employer4'),  name:'Linear Recruiter',role:'employer', bio:'Hiring at Linear', location:'Worldwide' },
  { email:'alice@example.com',    password: hashPw('seeker123'),  name:'Alice Johnson',   role:'seeker',   bio:'Senior React developer looking for remote roles', location:'Berlin, Germany' },
  { email:'bob@example.com',      password: hashPw('seeker123'),  name:'Bob Martínez',    role:'seeker',   bio:'Product designer with 6 years of experience',     location:'Barcelona, Spain' },
];

const userIds = {};
for (const u of users) {
  const result = insertUser.run(u);
  userIds[u.email] = result.lastInsertRowid;
}

// ── COMPANIES ─────────────────────────────────────────────────
const insertCompany = db.prepare(`
  INSERT INTO companies (owner_id, name, slug, website, description, size, industry, founded)
  VALUES (@owner_id, @name, @slug, @website, @description, @size, @industry, @founded)
`);

const companies = [
  { owner_id: userIds['stripe@remotenow.com'],  name:'Stripe',     slug:'stripe',     website:'https://stripe.com',    description:'Financial infrastructure for the internet.',           size:'500+',   industry:'FinTech',       founded:2010 },
  { owner_id: userIds['figma@remotenow.com'],   name:'Figma',      slug:'figma',      website:'https://figma.com',     description:'Collaborative design tool for teams.',                  size:'201-500',industry:'Design Tools',   founded:2012 },
  { owner_id: userIds['vercel@remotenow.com'],  name:'Vercel',     slug:'vercel',     website:'https://vercel.com',    description:'Frontend cloud platform for developers.',               size:'201-500',industry:'Developer Tools', founded:2015 },
  { owner_id: userIds['linear@remotenow.com'],  name:'Linear',     slug:'linear',     website:'https://linear.app',   description:'The issue tracker built for high-performance teams.',    size:'11-50',  industry:'Productivity',   founded:2019 },
  { owner_id: userIds['admin@remotenow.com'],   name:'Shopify',    slug:'shopify',    website:'https://shopify.com',  description:'Commerce platform for businesses of all sizes.',         size:'500+',   industry:'eCommerce',      founded:2006 },
  { owner_id: userIds['admin@remotenow.com'],   name:'Notion',     slug:'notion',     website:'https://notion.so',    description:'All-in-one workspace for notes, tasks, and wikis.',      size:'201-500',industry:'Productivity',   founded:2016 },
  { owner_id: userIds['admin@remotenow.com'],   name:'Cloudflare', slug:'cloudflare', website:'https://cloudflare.com',description:'Security, performance, and reliability for the web.',  size:'500+',   industry:'Infrastructure', founded:2009 },
];

const companyIds = {};
for (const c of companies) {
  const result = insertCompany.run(c);
  companyIds[c.slug] = result.lastInsertRowid;
}

// ── JOBS ──────────────────────────────────────────────────────
const insertJob = db.prepare(`
  INSERT INTO jobs (company_id, title, slug, description, requirements, benefits, category, type, level, salary_min, salary_max, location_type, is_featured, apply_url, expires_at)
  VALUES (@company_id, @title, @slug, @description, @requirements, @benefits, @category, @type, @level, @salary_min, @salary_max, @location_type, @is_featured, @apply_url, @expires_at)
`);

const insertTag = db.prepare(`INSERT OR IGNORE INTO job_tags (job_id, tag) VALUES (?, ?)`);

const expiry = (days) => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const jobs = [
  {
    company_id: companyIds['vercel'], title:'Senior Frontend Engineer', slug:'senior-frontend-vercel',
    description:'Join our frontend platform team building the fastest web experiences on the planet. You\'ll work on Next.js core, edge rendering, and developer tooling used by millions.',
    requirements:'5+ years with React/Next.js\nStrong TypeScript skills\nExperience with performance optimization\nFamiliarity with edge computing',
    benefits:'$140k–$180k salary\nEquity package\nFully remote\nUnlimited PTO\n$3,000/yr home office budget',
    category:'Engineering', type:'Full-Time', level:'Senior', salary_min:140000, salary_max:180000,
    location_type:'Worldwide', is_featured:1, apply_url:'https://vercel.com/careers', expires_at: expiry(30),
    tags: ['Next.js','React','TypeScript','Edge Computing']
  },
  {
    company_id: companyIds['figma'], title:'Product Designer', slug:'product-designer-figma',
    description:'Design the future of collaborative design. You\'ll own end-to-end experiences for millions of designers and developers, from ideation to polished pixel-perfect interfaces.',
    requirements:'4+ years product design experience\nStrong Figma skills (of course!)\nPortfolio showing complex B2B product work\nExperience running user research',
    benefits:'$120k–$150k\nEquity\nHealthcare\nAnnual learning budget',
    category:'Design', type:'Full-Time', level:'Mid-Level', salary_min:120000, salary_max:150000,
    location_type:'USA Only', is_featured:1, apply_url:'https://figma.com/careers', expires_at: expiry(30),
    tags: ['Figma','UI/UX','Prototyping','User Research']
  },
  {
    company_id: companyIds['stripe'], title:'Head of Product', slug:'head-of-product-stripe',
    description:'Lead product strategy for Stripe\'s core payments infrastructure. You\'ll manage a team of 8 PMs and work directly with engineering and design to shape the future of financial infrastructure.',
    requirements:'8+ years in product management\n3+ years in a leadership role\nFinTech or platform experience preferred\nExceptional communication skills',
    benefits:'$200k–$260k + bonus\nSignificant equity\nFull remote flexibility\nTop-tier healthcare',
    category:'Product', type:'Full-Time', level:'Director+', salary_min:200000, salary_max:260000,
    location_type:'USA Only', is_featured:1, apply_url:'https://stripe.com/jobs', expires_at: expiry(20),
    tags: ['Product Strategy','Roadmapping','Leadership','FinTech']
  },
  {
    company_id: companyIds['linear'], title:'Backend Engineer (Rust)', slug:'backend-engineer-rust-linear',
    description:'Build the high-performance backend powering Linear\'s real-time sync engine. We care deeply about code quality, performance, and reliability.',
    requirements:'Strong Rust experience (3+ years)\nDistributed systems knowledge\nPostgreSQL and Redis expertise\nPassion for high-performance systems',
    benefits:'$150k–$190k\nGenerous equity\nRemote-first culture\nTop equipment provided',
    category:'Engineering', type:'Full-Time', level:'Senior', salary_min:150000, salary_max:190000,
    location_type:'Europe', is_featured:0, apply_url:'https://linear.app/careers', expires_at: expiry(25),
    tags: ['Rust','PostgreSQL','Redis','Distributed Systems']
  },
  {
    company_id: companyIds['shopify'], title:'Data Analyst', slug:'data-analyst-shopify',
    description:'Turn billions of commerce data points into actionable insights for Shopify\'s merchants. You\'ll build dashboards, run experiments, and work cross-functionally with product and marketing.',
    requirements:'2+ years data analysis experience\nStrong SQL skills\nPython (pandas, numpy)\nExperience with Looker or similar BI tools',
    benefits:'$65k–$85k\nBenefits from day one\nFlexible hours\nRemote-first',
    category:'Data', type:'Full-Time', level:'Junior', salary_min:65000, salary_max:85000,
    location_type:'Worldwide', is_featured:0, apply_url:'https://shopify.com/careers', expires_at: expiry(28),
    tags: ['SQL','Python','Looker','Analytics']
  },
  {
    company_id: companyIds['cloudflare'], title:'DevOps / Site Reliability Engineer', slug:'sre-cloudflare',
    description:'Keep Cloudflare\'s global network running at 99.99%+ uptime. You\'ll own infrastructure automation, incident response, and system observability at massive scale.',
    requirements:'4+ years SRE or DevOps experience\nKubernetes and Terraform expertise\nAWS or GCP experience\nStrong on-call and incident response skills',
    benefits:'$130k–$165k\nEquity\nRemote-OK\nTop-of-market benefits',
    category:'DevOps', type:'Full-Time', level:'Senior', salary_min:130000, salary_max:165000,
    location_type:'Worldwide', is_featured:0, apply_url:'https://cloudflare.com/careers', expires_at: expiry(21),
    tags: ['Kubernetes','Terraform','AWS','SRE']
  },
  {
    company_id: companyIds['notion'], title:'Growth Marketing Manager', slug:'growth-marketing-notion',
    description:'Drive Notion\'s next phase of growth through data-driven marketing campaigns, SEO strategy, and lifecycle optimization. You\'ll own key acquisition and retention metrics.',
    requirements:'3+ years growth or performance marketing\nSEO and paid media expertise\nAnalytics tools (Amplitude, Mixpanel)\nStrong copywriting skills',
    benefits:'$90k–$120k\nEquity\nFlexible remote\n$1,500 wellness stipend',
    category:'Marketing', type:'Full-Time', level:'Mid-Level', salary_min:90000, salary_max:120000,
    location_type:'Worldwide', is_featured:0, apply_url:'https://notion.so/careers', expires_at: expiry(18),
    tags: ['SEO','Paid Ads','Analytics','Growth']
  },
  {
    company_id: companyIds['figma'], title:'Brand Designer', slug:'brand-designer-figma',
    description:'Shape the visual identity of one of the world\'s most loved design tools. You\'ll create campaigns, motion graphics, and brand assets that resonate globally.',
    requirements:'Portfolio showing strong brand work\nIllustrator + After Effects proficiency\nMotion design experience a plus\nTypography obsession required',
    benefits:'$80k–$110k\nContract to hire possible\nRemote\nCreative freedom',
    category:'Design', type:'Contract', level:'Mid-Level', salary_min:80000, salary_max:110000,
    location_type:'Europe', is_featured:0, apply_url:'https://figma.com/careers', expires_at: expiry(15),
    tags: ['Branding','Illustrator','Motion Design','Typography']
  },
];

for (const job of jobs) {
  const { tags, ...jobData } = job;
  const result = insertJob.run(jobData);
  const jobId = result.lastInsertRowid;
  for (const tag of tags) insertTag.run(jobId, tag);
}

// ── NEWSLETTER SUBSCRIBERS ────────────────────────────────────
const insertSub = db.prepare(`INSERT INTO subscribers (email, categories) VALUES (?, ?)`);
insertSub.run('alice@example.com', 'Engineering,Design');
insertSub.run('bob@example.com', 'Design,Product');

console.log('✅ Database seeded!');
console.log(`   👤 ${users.length} users`);
console.log(`   🏢 ${companies.length} companies`);
console.log(`   💼 ${jobs.length} jobs`);
