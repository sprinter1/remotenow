require('dotenv').config();
const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');
    await client.query('BEGIN');

    // ── Users ──────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('password123', 10);

    const { rows: [admin] } = await client.query(`
      INSERT INTO users (email, password, name, role) VALUES
        ('admin@remotenow.io', $1, 'Admin', 'admin')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [passwordHash]);

    const { rows: [employer1] } = await client.query(`
      INSERT INTO users (email, password, name, role) VALUES
        ('hr@stripe.com', $1, 'Stripe HR', 'employer')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [passwordHash]);

    const { rows: [employer2] } = await client.query(`
      INSERT INTO users (email, password, name, role) VALUES
        ('jobs@vercel.com', $1, 'Vercel Jobs', 'employer')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [passwordHash]);

    const { rows: [seeker] } = await client.query(`
      INSERT INTO users (email, password, name, role) VALUES
        ('alex@example.com', $1, 'Alex Developer', 'jobseeker')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [passwordHash]);

    // ── Companies ──────────────────────────────────────────────
    const { rows: [stripe] } = await client.query(`
      INSERT INTO companies (owner_id, name, slug, website, description, size, industry, hq_location)
      VALUES ($1, 'Stripe', 'stripe', 'https://stripe.com',
        'Financial infrastructure for the internet.', '1000+', 'Fintech', 'San Francisco, CA')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [employer1.id]);

    const { rows: [vercel] } = await client.query(`
      INSERT INTO companies (owner_id, name, slug, website, description, size, industry, hq_location)
      VALUES ($1, 'Vercel', 'vercel', 'https://vercel.com',
        'The platform for frontend developers.', '201-500', 'Developer Tools', 'Remote-first')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [employer2.id]);

    // ── Jobs ───────────────────────────────────────────────────
    const jobs = [
      {
        company_id: vercel.id,
        title: 'Senior Frontend Engineer',
        slug: 'senior-frontend-engineer-vercel',
        description: 'Join our core team building the future of frontend deployment. You will work on Next.js, our CLI tooling, and the dashboard.',
        requirements: '5+ years React experience. Deep knowledge of TypeScript. Experience with build tools.',
        category: 'Engineering', job_type: 'Full-Time', experience: 'Senior',
        salary_min: 140000, salary_max: 180000,
        region: 'Worldwide', apply_email: 'jobs@vercel.com', is_featured: true,
        tags: ['Next.js', 'React', 'TypeScript']
      },
      {
        company_id: stripe.id,
        title: 'Product Designer',
        slug: 'product-designer-stripe',
        description: 'Shape the design of products used by millions of developers and businesses worldwide.',
        requirements: '3+ years product design. Proficiency in Figma. Strong portfolio.',
        category: 'Design', job_type: 'Full-Time', experience: 'Mid-Level',
        salary_min: 120000, salary_max: 150000,
        region: 'USA Only', apply_email: 'hr@stripe.com', is_featured: true,
        tags: ['Figma', 'UI/UX', 'Prototyping']
      },
      {
        company_id: stripe.id,
        title: 'Backend Engineer (Go)',
        slug: 'backend-engineer-go-stripe',
        description: 'Build and maintain the core payment infrastructure handling billions of transactions.',
        requirements: 'Strong Go experience. Distributed systems knowledge. PostgreSQL expertise.',
        category: 'Engineering', job_type: 'Full-Time', experience: 'Senior',
        salary_min: 160000, salary_max: 210000,
        region: 'USA Only', apply_email: 'hr@stripe.com', is_featured: false,
        tags: ['Go', 'PostgreSQL', 'Distributed Systems']
      },
      {
        company_id: vercel.id,
        title: 'DevOps Engineer',
        slug: 'devops-engineer-vercel',
        description: 'Own and evolve the infrastructure powering millions of deployments per day.',
        requirements: 'Kubernetes, Terraform, AWS. Strong scripting skills.',
        category: 'DevOps', job_type: 'Full-Time', experience: 'Senior',
        salary_min: 130000, salary_max: 165000,
        region: 'Worldwide', apply_email: 'jobs@vercel.com', is_featured: false,
        tags: ['Kubernetes', 'Terraform', 'AWS']
      },
      {
        company_id: stripe.id,
        title: 'Growth Marketing Manager',
        slug: 'growth-marketing-manager-stripe',
        description: 'Drive user acquisition and retention through data-driven marketing campaigns.',
        requirements: '3+ years growth/performance marketing. SQL skills. Experience with Mixpanel/Amplitude.',
        category: 'Marketing', job_type: 'Full-Time', experience: 'Mid-Level',
        salary_min: 90000, salary_max: 120000,
        region: 'Europe', apply_email: 'hr@stripe.com', is_featured: false,
        tags: ['SEO', 'Paid Ads', 'Analytics']
      },
    ];

    for (const job of jobs) {
      const { rows: [newJob] } = await client.query(`
        INSERT INTO jobs
          (company_id, title, slug, description, requirements, category, job_type,
           experience, salary_min, salary_max, region, apply_email, is_featured)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
      `, [job.company_id, job.title, job.slug, job.description, job.requirements,
          job.category, job.job_type, job.experience, job.salary_min, job.salary_max,
          job.region, job.apply_email, job.is_featured]);

      for (const tag of job.tags) {
        await client.query(
          `INSERT INTO job_tags (job_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newJob.id, tag]
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('📋 Test accounts:');
    console.log('   Admin:    admin@remotenow.io  / password123');
    console.log('   Employer: hr@stripe.com       / password123');
    console.log('   Seeker:   alex@example.com    / password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
