# STAGE 9.2.1 — Isolated Staging Deployment Guide & Operational Manual

**Project:** Bagan Medical Hall Pharmacy POS, Accounting ERP & Unified Authentication Architecture  
**Document:** `STAGE_9_2_1_DEPLOYMENT_AND_STAGING_GUIDE.md`  
**Workspace:** `C:\Users\Dev\.gemini\antigravity\scratch\pharmacy-pos-accounting`  
**Stage:** 9.2.1 — Staging Package Correction and Publication Preparation  
**Target Staging Domain:** `joyful-brown-jellyfish.devkumarrajbanshi.com.np`  
**Staging Frontend Document Root:** `/home/devkumar/joyful-brown-jellyfish.103-233-58-13.cpanel.site`  
**Staging Backend Root:** `/home/devkumar/bagan-staging-api`  
**Staging API URL:** `https://joyful-brown-jellyfish.devkumarrajbanshi.com.np/api`  
**PostgreSQL Database:** `devkumar_baganstaging`  
**PostgreSQL User:** `devkumar_adminbaganstaging`  
**Node.js Runtime Target:** `24.22.3` (cPanel CloudLinux Node.js selector)  
**Deployment Archive:** `pharmacy-pos-staging-candidate-stage9.2.1.zip`  
**Status:** COMPLETE STAGING DEPLOYMENT SPECIFICATION (Zero Remote / Zero Production Operations)

---

## 1. Hosting Architecture & Isolated Staging Topology

The staging environment enforces complete physical filesystem and database isolation from all production services on Himalayan Hosting / cPanel:

```
+---------------------------------------------------------------------------------------------------+
| Himalayan Hosting cPanel Account: /home/devkumar/                                                 |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [SERVICE 1: ISOLATED STAGING BACKEND API SERVICE]                                                |
|  Filesystem Path: /home/devkumar/bagan-staging-api                                                 |
|  Engine: cPanel Phusion Passenger (CloudLinux Node.js 24.22.3 ESM)                                 |
|  Startup Script: server.js                                                                        |
|  Mount Path: /api (Reverse-proxied via cPanel Application Manager)                                 |
|  Key Files: server.js, package.json, package-lock.json, upload.php (403 guard),                    |
|             .env.example, backend/, database/                                                     |
|                                                                                                   |
|  [SERVICE 2: ISOLATED STAGING FRONTEND SPA WEB SERVICE]                                            |
|  Filesystem Path: /home/devkumar/joyful-brown-jellyfish.103-233-58-13.cpanel.site                 |
|  Domain: joyful-brown-jellyfish.devkumarrajbanshi.com.np                                          |
|  Engine: LiteSpeed / Apache Static Web Server                                                     |
|  Document Root: index.html                                                                        |
|  Media Upload Directory: /home/devkumar/joyful-brown-jellyfish.103-233-58-13.cpanel.site/website_images |
|  Key Files: index.html, css/, js/, website_images/, .htaccess                                     |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
|  [STRICTLY PROHIBITED PRODUCTION TARGETS — ZERO ACCESS / ZERO DEPLOYMENT]                         |
|  1. /home/devkumar/bagan-api                         <-- PRODUCTION BACKEND (PROHIBITED)          |
|  2. /home/devkumar/bagan.medical.cpanel.site         <-- PRODUCTION FRONTEND (PROHIBITED)         |
|  3. /home/devkumar/public_html                       <-- LEGACY HOSTING ROOT (PROHIBITED)         |
|  4. devkumar_amritstore                              <-- PRODUCTION DATABASE (PROHIBITED)         |
|  5. devkumar_baganmedicalhall                        <-- PRODUCTION DATABASE (PROHIBITED)         |
+---------------------------------------------------------------------------------------------------+
```

> [!CAUTION]
> **STRICT PRODUCTION ISOLATION ENFORCEMENT:**  
> Under no circumstances may application code, configuration, backend scripts, database migrations, or media files be deployed to or run against production paths:
> - Never touch `/home/devkumar/bagan-api`
> - Never touch `/home/devkumar/bagan.medical.cpanel.site`
> - Never touch `/home/devkumar/public_html`
> - Never connect to or migrate `devkumar_amritstore` or `devkumar_baganmedicalhall`
> All staging operations must strictly target `/home/devkumar/bagan-staging-api`, `/home/devkumar/joyful-brown-jellyfish.103-233-58-13.cpanel.site`, and database `devkumar_baganstaging`.

---

## 2. Environment Variables Specification

Configure the following environment variables in **cPanel -> Setup Node.js App -> Application Environment Variables** for `/home/devkumar/bagan-staging-api`:

| Variable | Required | Staging Configuration Value | Technical Description & Security Rules |
|---|:---:|---|---|
| `NODE_ENV` | **YES** | `production` | Enforces fail-closed security, secure cookie flags, and strict API-only routing. |
| `PORT` | Optional | Auto-assigned by Passenger | Internal listening port managed by Phusion Passenger. |
| `DB_HOST` | **YES** | `127.0.0.1` | PostgreSQL database hostname or IP. |
| `DB_PORT` | **YES** | `5432` | PostgreSQL database listening port. |
| `DB_NAME` | **YES** | `devkumar_baganstaging` | **Isolated staging database only.** |
| `DB_USER` | **YES** | `devkumar_adminbaganstaging` | Staging PostgreSQL user (requires DDL/DML on public schema). |
| `DB_PASSWORD` | **YES** | `[SECURE_STAGING_DB_PASSWORD]` | Strong password generated in cPanel PostgreSQL. |
| `DB_SSL` | Optional | `false` | Set `true` if SSL connection to PostgreSQL is required. |
| `SESSION_SECRET` | **YES** | `[32+_CHAR_CRYPTO_RANDOM_SECRET]` | Cryptographic secret for signing session cookies (`s:token.hmac`). Minimum 32 characters. |
| `CSRF_SECRET` | **NO** | *(Omit)* | **NOT required at runtime.** System uses Synchronizer Token Pattern (STP) with per-session SHA-256 tokens stored in `user_sessions.csrf_hash`. |
| `CORS_ORIGIN` | **YES** | `https://joyful-brown-jellyfish.devkumarrajbanshi.com.np` | Explicit staging origin. Wildcard `*` and empty values cause fatal startup exit (`process.exit(1)`). Trailing slashes are stripped. |
| `TRUST_PROXY` | **YES** | `loopback` | Reverse proxy trust level. Accepts `loopback` or `1`. Avoids broad trust vulnerabilities behind Passenger/LiteSpeed. |
| `MEDIA_UPLOAD_DIR` | **YES** | `/home/devkumar/joyful-brown-jellyfish.103-233-58-13.cpanel.site/website_images` | Absolute path where uploaded images are stored on disk. Fails closed with fatal startup crash if missing or relative. |
| `MEDIA_PUBLIC_URL_PREFIX` | **YES** | `/website_images` | Public URL prefix for serving uploaded assets. |

---

## 3. Staging Deployment Checklist & Responsibilities Matrix

| Step | Staging Task | Local Status | Staging Execution Requirement | Responsible Component |
|:---:|---|:---:|:---:|---|
| **1** | Source Code & Tests Verification | **COMPLETED** | Verified locally (14 test suites, 491+ assertions passed). | Node.js Test Runner |
| **2** | Packaging & POSIX Archive | **COMPLETED** | Validated (100% `/` paths, 0 `\`, 0 traversal). | Packaging Engine |
| **3** | npm Dependency Reproducibility | **VERIFIED** | Generated genuine `package-lock.json` and verified with `npm ci --omit=dev`. | npm 10.8.2 CLI |
| **4** | Staging Directory Setup | *Pending Staging* | Create `/home/devkumar/bagan-staging-api` on host. | Staging Operator |
| **5** | Isolated Staging Database Creation | *Pending Staging* | Create `devkumar_baganstaging` in cPanel PostgreSQL. | PostgreSQL Admin |
| **6** | Staging Database User Assignment | *Pending Staging* | Grant `devkumar_adminbaganstaging` all privileges on `devkumar_baganstaging`. | PostgreSQL Admin |
| **7** | Sequential Migrations Execution | *Pending Staging* | Run `001_auth_system.sql`, `002`, `003` via `psql` targeting `devkumar_baganstaging`. | PostgreSQL Admin |
| **8** | Schema Readiness Verification | **VERIFIED (Mock)** | Run `verifyMediaSchemaReadiness(pool)` upon backend startup. | Backend Startup Gate |
| **9** | Super Admin Provisioning | **VERIFIED (Mock)** | Run `node backend/scripts/bootstrapSuperAdmin.js` targeting staging DB. | CLI Script |
| **10** | Node.js 24.22.3 App Setup | *Pending Staging* | Configure Node 24.22.3 in cPanel Setup Node.js App for `bagan-staging-api`. | cPanel Application Manager |
| **11** | Deterministic Dependency Install | *Pending Staging* | Run `npm ci --omit=dev` using `package-lock.json` in `/home/devkumar/bagan-staging-api`. | Host npm CLI |
| **12** | Application Process Reload | *Pending Staging* | `touch /home/devkumar/bagan-staging-api/tmp/restart.txt`. | Passenger Phusion |
| **13** | Live End-to-End Browser Testing | *Pending Staging* | Perform login, POS checkout, image upload at `https://joyful-brown-jellyfish.devkumarrajbanshi.com.np`. | QA / Staging Operator |

---

## 4. Step-by-Step Staging Execution Procedure

### Step 4.1: Archive Upload & Safe Extraction
1. Upload `pharmacy-pos-staging-candidate-stage9.2.1.zip` to `/home/devkumar/`:
   ```bash
   sha256sum pharmacy-pos-staging-candidate-stage9.2.1.zip
   ```
   Verify checksum matches `STAGE_9_2_1_SHA256SUMS.txt`.
2. Extract into staging temporary directory:
   ```bash
   mkdir -p /home/devkumar/staging_deploy_921
   cd /home/devkumar/staging_deploy_921
   unzip -q /home/devkumar/pharmacy-pos-staging-candidate-stage9.2.1.zip
   ```
3. Deploy to staging target directories:
   ```bash
   # Create isolated staging backend directory
   mkdir -p /home/devkumar/bagan-staging-api
   
   # Deploy Backend API to isolated staging directory
   rsync -av /home/devkumar/staging_deploy_921/bagan-api/ /home/devkumar/bagan-staging-api/
   
   # Deploy Frontend SPA to isolated staging document root
   rsync -av /home/devkumar/staging_deploy_921/bagan.medical.cpanel.site/ /home/devkumar/joyful-brown-jellyfish.103-233-58-13.cpanel.site/
   ```

### Step 4.2: Staging Database Migrations
Apply migrations in strict sequential order against `devkumar_baganstaging`:
```bash
# 1. Base Authentication & Dynamic RBAC Schema
psql -U devkumar_adminbaganstaging -h 127.0.0.1 -d devkumar_baganstaging -f /home/devkumar/bagan-staging-api/database/001_auth_system.sql

# 2. Password Reset Isolation & Audit Log Preservation
psql -U devkumar_adminbaganstaging -h 127.0.0.1 -d devkumar_baganstaging -f /home/devkumar/bagan-staging-api/database/002_password_reset_isolation.sql

# 3. Media Center Relational Tables, Folders & Indexes
psql -U devkumar_adminbaganstaging -h 127.0.0.1 -d devkumar_baganstaging -f /home/devkumar/bagan-staging-api/database/003_media_center.sql
```

### Step 4.3: Initial Developer Super Admin Provisioning
Execute the bootstrap script in staging backend:
```bash
cd /home/devkumar/bagan-staging-api
node backend/scripts/bootstrapSuperAdmin.js
```
- When prompted: `Type the exact database name "devkumar_baganstaging" to confirm: `, type `devkumar_baganstaging`.
- Provide the developer email and secure initial password.
- The script creates the `SUPER_ADMIN` account with PBKDF2 220,000 iterations and `must_reset_password = true`.

### Step 4.4: Dependencies Installation
Install dependencies cleanly using the locked graph:
```bash
cd /home/devkumar/bagan-staging-api
npm ci --omit=dev
```

### Step 4.5: Passenger Restart & Health Check
```bash
mkdir -p /home/devkumar/bagan-staging-api/tmp
touch /home/devkumar/bagan-staging-api/tmp/restart.txt
```
Probe backend health:
```bash
curl -i https://joyful-brown-jellyfish.devkumarrajbanshi.com.np/api/health
```

---

## 5. Non-Destructive Rollback & Recovery Plan

In the event of a staging issue:
1. **Passenger Rollback:**
   Restore previous application files from snapshot backup and restart Passenger:
   ```bash
   touch /home/devkumar/bagan-staging-api/tmp/restart.txt
   ```
2. **Database Rollback:**
   Restore staging database from the pre-migration dump:
   ```bash
   pg_restore -U devkumar_adminbaganstaging -h 127.0.0.1 -d devkumar_baganstaging --clean --if-exists -v /home/devkumar/backups/staging_pre_migration_[TIMESTAMP].dump
   ```
   Do not execute `DROP DATABASE` or `DROP SCHEMA CASCADE`.
