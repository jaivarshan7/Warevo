# Warevo — Setup, Configuration & Deployment Guide

This document describes local developer setup, environment configuration, automated testing, and cloud deployment procedures for **Warevo — Multi-Tenant Warehouse Management System (WMS)**.

---

## 1. Local Developer Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **npm**: v9.0.0 or higher.
- **Supabase Account**: Local Supabase CLI instance or cloud-hosted project.

### Installation Steps
```bash
# 1. Clone repository
git clone <repository_url> warevo
cd warevo

# 2. Install dependencies
npm install

# 3. Configure environment file
cp .env.example .env
```

Edit `.env` to supply your Supabase project URL and anon public key.

---

## 2. Environment Variables Reference

| Variable | Environment | Required | Purpose | Example / Format |
|:---------|:-----------:|:--------:|:--------|:-----------------|
| `VITE_SUPABASE_URL` | Client (Vite) | Yes | Supabase API endpoint | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Client (Vite) | Yes | Supabase public anonymous key | `eyJhbGciOi...` |
| `VITE_APP_URL` | Client (Vite) | Optional | Base URL for origin resolution | `http://localhost:3000` / `https://warevo.online` |
| `APP_URL` | Server (Edge) | Optional | Application URL used in email notification links | `https://warevo.online` |
| `DATABASE_URL` | Local Tooling | Dev/Migration | PostgreSQL direct connection URL (Prisma/Scripts) | `postgresql://user:pass@host:5432/db` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (Edge) | Server-only | Elevated admin operations (never expose to Vite) | `eyJhbGciOi...` |

> [!WARNING]
> Never prefix secrets (such as database passwords or service role keys) with `VITE_`. Any variable starting with `VITE_` is bundled into the client-side JavaScript.

---

## 3. Development, Testing & Verification Commands

```bash
# Start local Vite development server
npm run dev

# Run Vitest test suites (224 automated unit tests)
npm test

# Run tests with interactive UI
npx vitest --ui

# Type check and build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 4. Production Deployment Workflow

Warevo is designed for modern frontend hosting platforms (such as Vercel, Netlify, or Cloudflare Pages) coupled with Supabase cloud infrastructure.

### Frontend Hosting (Vercel)
1. Link your GitHub repository to Vercel.
2. Framework Preset: **Vite** (Build Command: `npm run build`, Output Directory: `dist`).
3. Add Environment Variables:
   - `VITE_SUPABASE_URL` = `https://<production-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<production-anon-key>`
   - `VITE_APP_URL` = `https://warevo.online`
4. Deploy the production branch.

### Supabase Backend Deployment
1. **Schema Initialization**: Execute `supabase/bootstrap/production_schema_bootstrap.sql` as documented in [`docs/PRODUCTION_SCHEMA_BOOTSTRAP.md`](file:///d:/Dev/warehouse_management/docs/PRODUCTION_SCHEMA_BOOTSTRAP.md).
2. **Edge Functions Deployment**:
   ```powershell
   npx supabase functions deploy create-employee --project-ref <production_ref>
   npx supabase functions deploy send-email --project-ref <production_ref>
   ```
3. **Storage Buckets**: Confirm `invoices`, `delivery-evidence`, and `payment-proofs` buckets are private.
