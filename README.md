# Bagan Medical Hall - Pharmacy Management, POS & Complete Accounting ERP

Bagan Medical Hall is an enterprise-grade, all-in-one web application built for modern pharmacies, combining **High-Speed Pharmacy POS Cashiering**, **Clinical Drug Master & Expiry Tracking**, **Double-Entry Financial Accounting**, and a multi-tier **Developer Hub Architecture**.

---

## 🏛️ System Architecture

Based on the system specification:

```
                  ┌─────────────────────────────────┐
                  │             Domain              │
                  │   (Public Subdomain Entry)      │
                  └───────────────┬─────────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
                 ▼                                 ▼
       ┌───────────────────┐             ┌───────────────────┐
       │   Staff Login     │             │  Developer Login  │
       │ (Default Gateway) │             │ (Click [Rx] Logo) │
       └─────────┬─────────┘             └─────────┬─────────┘
                 │                                 │
                 ▼                                 ▼
       ┌───────────────────┐             ┌───────────────────┐
       │  Dispensary POS   │             │   Developer Hub   │
       │   & Operations    │             │ (Full-Page View)  │
       └───────────────────┘             └─────────┬─────────┘
                                                   │
         ┌───────────────────┬─────────────────────┼─────────────────────┬─────────────────────┐
         ▼                   ▼                     ▼                     ▼                     ▼
┌──────────────────┐┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Staff Accounts  ││    Global UI     │ │     Page UI      │ │   Media Center   │ │     Database     │
│  & Permissions   ││     Editing      │ │     Editing      │ │  (website_images)│ │    Management    │
│ (Granular Checks)││(Dual Logos & Hex)│ │(Login & POS Page)│ │(Asset Browser &) │ │(Audit & Backups) │
└──────────────────┘└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 🔐 Multi-Tier Authentication & Access Rules

> [!WARNING]
> **LOCAL TESTING / DEMONSTRATION CREDENTIALS ONLY:**  
> The test accounts documented below (`pharmacist` / `user123` and `developer` / `dev123`) are provided **EXCLUSIVELY for local offline development, demonstration, and automated test environments**.  
> **THEY MUST NEVER BE USED IN OR CONFIGURED FOR PRODUCTION.**  
> 
> In a production deployment:
> - The database schema migrations create **ZERO default user accounts**. No default staff or developer accounts are silently seeded.
> - The initial Developer Super Admin account must be provisioned exclusively via the controlled CLI script `node backend/scripts/bootstrapSuperAdmin.js`, which enforces exact database name confirmation and sets a unique, cryptographically strong password with mandatory first-login reset (`must_change_password = true`).
> - All staff accounts must be provisioned individually through the Developer Hub with appropriate granular RBAC permissions.

1. **Staff Login (Default Portal — Local Testing Account)**:
   - The default sign-in screen loaded by visitors.
   - Local Offline Test Account:
     - **Username**: `pharmacist`
     - **Password**: `user123`
   - Access is restricted strictly according to the permissions assigned to the staff account by the Developer.

2. **Developer Login (Secret Access — Local Testing Account)**:
   - Cashier tab has been removed. Only **Staff** and **Developer** exist.
   - Developer Login is opened **by clicking the [Rx] logo** at the top of the login card.
   - Local Offline Test Account:
     - **Username**: `developer`
     - **Password**: `dev123`
   - Unrestricted super-administrator access across all financial ledgers, settings, and developer governance.

---

## ⚙️ Developer Hub Modules (Full-Page View)

Accessible by clicking **⚙️ Developer Hub** in the topbar or sidebar when logged in as Developer:

1. 👥 **Staff Accounts and Permission**:
   - Create, edit, and deactivate staff members.
   - Granular permission checkboxes per staff member:
     - POS Counter Dispensing
     - Drug Master & Expiry Inventory
     - Patient Accounts & Credit Ledger
     - Supplier Accounts & Purchase GRN
     - Manual Journal Entry Posting
     - Financial Statements & Audit Reports
     - Price Override & Discounting
     - Stock Quarantine & Loss Write-Off
     - Backup & Export
     - Developer Governance Tools

2. 🌐 **Global UI Editing (Universal Across Whole App)**:
   - **🖼️ Dual Logo System (Contextual Background Fit)**:
     - **🎨 Coloured Logo (Light Backgrounds)**: Optimized for white/light containers such as POS thermal receipts, customer invoices, and the staff login card.
     - **⚪ White Logo (Dark Backgrounds)**: Pure vector white logo optimized for high contrast on dark backgrounds such as the main application sidebar (`#0f172a`), topbar, and dark dialogs.
     - **📁 website_images/ Storage**: Every upload is saved directly into the website's `website_images/` directory.
     - Buttons on each logo: `Upload to website_images`, `📁 Choose from Media Center`, and `Reset Default`.
   - **🛡️ Fallback Logo (Fallback Image or Text Emblem)**:
     - Automatically renders if primary logo images fail to load or are absent.
     - Toggle between **Fallback Image** (custom uploaded image in `website_images/` or chosen from Media Center) and **Text Emblem** (e.g. `Rx`, up to 4 characters).
   - **🎨 Color Hex Codes & Primary/Secondary Palette**:
     - **Primary Color**: Direct Hex code input (`#RRGGBB`) + visual color picker + swatch presets. Applies to primary buttons, active navigation links, and focus borders.
     - **Secondary Color**: Direct Hex code input (`#RRGGBB`) + visual color picker + swatch presets. Applies to gradients, badges, and secondary accents.
     - Live dynamic palette bar displaying `PRIMARY: #HEX` | `SECONDARY: #HEX` and live UI component previews.
   - **Universal Store Information**:
     - **Universal Pharmacy Name** (e.g. `Bagan Medical Hall`)
     - **Universal Contacts** (Phone numbers, Email, combined text)
     - **Universal Physical Address**
     - **Universal Tagline**
     - **Universal Greeting & Announcement Message** (Broadcast banner on Login & Topbar)

3. 🎨 **Page UI Editing (Separate Dedicated Page)**:
   - **Login Page UI**: Customize primary and secondary hex colors, choose from 6 1-click medical color themes, and toggle the 1-click test credentials helper on/off.
   - **POS Dispensing Page Rules**: Configure staff default landing view, maximum cashier discount percentage guard (e.g. 15%), receipt footer closing note, Schedule H prescribing doctor enforcement, and Bill Parking / Hold Tickets [F8].

4. 📸 **Media Center & Asset Management (`website_images/`)**:
   - Centralized asset browser for all images stored in `website_images/`.
   - Preview cards displaying thumbnail, filename, file size, upload timestamp, and saved path.
   - Quick action buttons on every asset:
     - `🎨 Set as Coloured Logo` (instantly updates global settings for light backgrounds)
     - `⚪ Set as White Logo` (instantly updates global settings for dark backgrounds)
     - `🛡️ Set as Fallback` (assigns asset as fallback logo image)
     - `📋 Copy Path` (copies `website_images/<filename>` to clipboard)
     - `🗑️ Delete` (safely removes uploaded items)
   - Real-time search filter by filename.
   - Reusable **Media Picker Modal** accessible from any logo upload field in the system.

5. 🗄️ **Database Management**:
   - Live storage footprint calculator.
   - Real-time double-entry Trial Balance equality verification (Total Debits == Total Credits).
   - Live raw database JSON schema inspector.
   - One-click balance recalculation from general journal.
   - Full raw JSON backup export and clean factory demo reset.

---

## 🚀 Key Dispensary & Accounting Modules

### 1. 🏥 Pharmacy POS Counter
- High-speed drug search across Brand names, Generic molecules, and Barcodes.
- FEFO (First Expire, First Out) batch tracking with near-expiry color tags.
- Multi-tender checkout: Cash, Card, UPI/QR, and Patient Credit.
- 80mm / 58mm thermal receipt printing with itemized breakdown and Schedule H notices.
- Bill Parking / Hold Tickets (`F8`).

### 2. 📊 Double-Entry Accounting ERP
- Standard Chart of Accounts (COA) across Assets, Liabilities, Equity, Revenue, and Expenses.
- Automatic double-entry posting for sales, inventory cost of goods sold, purchases, supplier payments, and customer receipts.
- Real-time General Journal, General Ledger, Trial Balance, P&L Statement, Balance Sheet, and GST/Tax Liability reports.

### 3. 👥 Customer & Supplier Management
- Patient credit limits, clinical profiles, allergy alerts, and statements of account.
- Supplier invoices, payment vouchers, and Inward Purchase Bills (Goods Receipt Notes).

### 4. 💊 Drug Master & Expiry Inventory
- Batch management, 30/60/90-day expiry watch desk, low stock alerts, and quarantine write-offs.

---

## 🌐 Isolated Staging Deployment Specification (Stage 9.2.1)

Staging Domain: `https://joyful-brown-jellyfish.devkumarrajbanshi.com.np/`  
Staging API URL: `https://joyful-brown-jellyfish.devkumarrajbanshi.com.np/api`  
Node.js Target Runtime: `24.22.3` (cPanel Phusion Passenger)  
Application Environment: `NODE_ENV=production` (isolated staging instance)  

> [!CAUTION]
> **STRICT PRODUCTION ISOLATION BOUNDARIES:**
> The following production resources are **STRICTLY PROHIBITED** from being modified, targeted, or accessed during staging:
> 1. Production Backend: `/home/devkumar/bagan-api` (PROHIBITED)
> 2. Production Frontend: `/home/devkumar/bagan.medical.cpanel.site` (PROHIBITED)
> 3. Permanently Forbidden Directory: `/home/devkumar/public_html` (PROHIBITED)
> 4. Production PostgreSQL Databases: `devkumar_amritstore` and `devkumar_baganmedicalhall` (PROHIBITED)
> 
> Under NO circumstances should staging files or migrations be executed against production paths or databases.

### Staging Hosting Architecture & Split Layout:

1. **Staging Backend Application Root (Node.js 24.22.3 / cPanel Phusion Passenger):**
   - **Target Path:** `/home/devkumar/bagan-staging-api`
   - **API Prefix:** `/api` (Reverse-proxied via web server)
   - **Contents:** `server.js`, `package.json`, `package-lock.json`, `upload.php` (403 placeholder), `backend/`, and `database/` migration scripts.
   - **Mandatory Environment Variables (configured in cPanel Node.js Application Manager):**
     - `NODE_ENV=production`
     - `DB_HOST=127.0.0.1`
     - `DB_PORT=5432`
     - `DB_NAME=devkumar_baganstaging` (Isolated staging database)
     - `DB_USER=devkumar_adminbaganstaging` (Isolated staging DB user)
     - `DB_PASSWORD=replace_with_strong_random_db_password` (Do not commit real password)
     - `SESSION_SECRET=replace_with_at_least_32_char_crypto_random_session_secret`
     - `CORS_ORIGIN=https://joyful-brown-jellyfish.devkumarrajbanshi.com.np`
     - `MEDIA_UPLOAD_DIR=/home/devkumar/joyful-brown-jellyfish.103-233-58-13.cpanel.site/website_images`
     - `MEDIA_PUBLIC_URL_PREFIX=/website_images`
     - `TRUST_PROXY=loopback`
   - **Database Migrations:** Apply `database/001_auth_system.sql`, `database/002_password_reset_isolation.sql`, and `database/003_media_center.sql` strictly against `devkumar_baganstaging`.
   - **Passenger Restart:** `touch /home/devkumar/bagan-staging-api/tmp/restart.txt` (staging only).

2. **Staging Frontend Document Root (Static Web Assets):**
   - **Target Path:** `/home/devkumar/joyful-brown-jellyfish.103-233-58-13.cpanel.site`
   - **Contents:** `index.html`, `css/styles.css`, `js/` (client application), and `website_images/` (branding assets).
   - **Isolation Requirement:** Backend source files, database scripts, and `.env*` files must NEVER be deployed to the frontend document root.

3. **Deployment Archive:**
   - Staging candidate archive: `pharmacy-pos-staging-candidate-stage9.2.1.zip`
   - Verified with 100% POSIX forward slashes (`/`), zero test files, zero duplicate migrations, and clean payload isolation.
   - Preserves all historical release candidates (`9.1.9.1`, `9.1.9`, `9.1.8`, `9.1.7.1`, etc.).
   - Actual deployment requires separate, explicit authorization.

---

## 💻 Running Locally on Windows

- **Method 1 (Instant)**: Double-click `start-app.bat` to open directly in Google Chrome / Edge.
- **Method 2 (Local Web Server)**: Double-click `start-server.bat` to launch the built-in PowerShell HTTP server on `http://localhost:8080/`.
