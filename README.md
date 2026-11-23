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

1. **Staff Login (Default Portal)**:
   - The default sign-in screen loaded by visitors.
   - Default Test Account:
     - **Username**: `pharmacist`
     - **Password**: `user123`
   - Access is restricted strictly according to the permissions assigned to the staff account by the Developer.

2. **Developer Login (Secret Access)**:
   - Cashier tab has been removed. Only **Staff** and **Developer** exist.
   - Developer Login is opened **by clicking the [Rx] logo** at the top of the login card.
   - Default Test Account:
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

## 🌐 Deploying to your Subdomain

Target Subdomain: `http://sociable-lavender-mule.devkumarrajbanshi.com.np/`

The deployment archive `pharmacy-pos-deploy.zip` contains all self-contained files:
- `index.html`
- `css/styles.css`
- `js/icons.js`
- `js/db.js`
- `js/auth.js`
- `js/pos.js`
- `js/accounting.js`
- `js/accounts-mgmt.js`
- `js/inventory.js`
- `js/dashboard.js`
- `js/app.js`

### Deployment Steps (via cPanel / File Manager):
1. Log in to your hosting cPanel at `devkumarrajbanshi.com.np:2083`.
2. Open **File Manager** and navigate to the document root directory for `sociable-lavender-mule.devkumarrajbanshi.com.np` (typically `public_html/sociable-lavender-mule` or `subdomains/sociable-lavender-mule`).
3. Click **Upload** and upload `pharmacy-pos-deploy.zip`.
4. Right-click `pharmacy-pos-deploy.zip` and select **Extract**.
5. Ensure `index.html` resides directly in the root of the subdomain folder.
6. Visit `http://sociable-lavender-mule.devkumarrajbanshi.com.np/` in any browser!

---

## 💻 Running Locally on Windows

- **Method 1 (Instant)**: Double-click `start-app.bat` to open directly in Google Chrome / Edge.
- **Method 2 (Local Web Server)**: Double-click `start-server.bat` to launch the built-in PowerShell HTTP server on `http://localhost:8080/`.
