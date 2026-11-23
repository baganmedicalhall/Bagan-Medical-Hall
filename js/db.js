/**
 * Pharmacy POS & Accounting System - Database & Double-Entry Accounting Core
 * Manages local storage persistence, realistic seed data, and transaction engine.
 */

const DB_KEY = 'pharmacy_app_data_v1';

// Standard Chart of Accounts
const DEFAULT_ACCOUNTS = [
  // Assets (1000s)
  { id: '1010', code: '1010', name: 'Cash in Hand (POS Drawer)', type: 'Asset', subType: 'Current Asset', normal: 'Debit', balance: 2500.00 },
  { id: '1020', code: '1020', name: 'Main Bank Account (Operating)', type: 'Asset', subType: 'Current Asset', normal: 'Debit', balance: 18450.00 },
  { id: '1030', code: '1030', name: 'Accounts Receivable (Patient Credit)', type: 'Asset', subType: 'Current Asset', normal: 'Debit', balance: 254.50 },
  { id: '1040', code: '1040', name: 'Pharmacy Inventory / Stock Asset', type: 'Asset', subType: 'Current Asset', normal: 'Debit', balance: 8320.00 },
  { id: '1510', code: '1510', name: 'Pharmacy Fixtures, Cold Chain & POS Hardware', type: 'Asset', subType: 'Fixed Asset', normal: 'Debit', balance: 4500.00 },
  
  // Liabilities (2000s)
  { id: '2010', code: '2010', name: 'Accounts Payable (Drug Suppliers)', type: 'Liability', subType: 'Current Liability', normal: 'Credit', balance: 3630.00 },
  { id: '2020', code: '2020', name: 'Sales Tax / GST Payable', type: 'Liability', subType: 'Current Liability', normal: 'Credit', balance: 344.50 },
  { id: '2030', code: '2030', name: 'Accrued Pharmacist Wages & Payroll', type: 'Liability', subType: 'Current Liability', normal: 'Credit', balance: 0.00 },

  // Equity (3000s)
  { id: '3010', code: '3010', name: "Owner's Capital / Pharmacy Equity", type: 'Equity', subType: 'Equity', normal: 'Credit', balance: 25000.00 },
  { id: '3020', code: '3020', name: 'Retained Earnings', type: 'Equity', subType: 'Equity', normal: 'Credit', balance: 3650.00 },
  { id: '3030', code: '3030', name: "Owner's Drawings", type: 'Equity', subType: 'Contra Equity', normal: 'Debit', balance: 0.00 },

  // Revenue (4000s)
  { id: '4010', code: '4010', name: 'Medicine Sales (Rx & OTC)', type: 'Revenue', subType: 'Operating Revenue', normal: 'Credit', balance: 4120.00 },
  { id: '4020', code: '4020', name: 'Prescription Dispensing & Advisory Fees', type: 'Revenue', subType: 'Service Revenue', normal: 'Credit', balance: 240.00 },
  { id: '4030', code: '4030', name: 'Sales Discounts Allowed', type: 'Revenue', subType: 'Contra Revenue', normal: 'Debit', balance: 85.00 },

  // Expenses (5000s)
  { id: '5010', code: '5010', name: 'Cost of Goods Sold (COGS)', type: 'Expense', subType: 'Direct Expense', normal: 'Debit', balance: 2410.00 },
  { id: '5020', code: '5020', name: 'Store Rent Expense', type: 'Expense', subType: 'Operating Expense', normal: 'Debit', balance: 800.00 },
  { id: '5030', code: '5030', name: 'Salaries & Staff Wages', type: 'Expense', subType: 'Operating Expense', normal: 'Debit', balance: 1100.00 },
  { id: '5040', code: '5040', name: 'Electricity, Cold Chain & Utilities', type: 'Expense', subType: 'Operating Expense', normal: 'Debit', balance: 215.00 },
  { id: '5050', code: '5050', name: 'Medicine Expiry, Spoilage & Breakage Loss', type: 'Expense', subType: 'Operating Expense', normal: 'Debit', balance: 65.00 },
  { id: '5060', code: '5060', name: 'Pharmacy Licensing & Regulatory Fees', type: 'Expense', subType: 'Administrative Expense', normal: 'Debit', balance: 150.00 },
  { id: '5070', code: '5070', name: 'Packaging, Prescription Bags & Labels', type: 'Expense', subType: 'Operating Expense', normal: 'Debit', balance: 45.00 },
  { id: '5080', code: '5080', name: 'Bank Charges & POS Terminal Processing', type: 'Expense', subType: 'Financial Expense', normal: 'Debit', balance: 35.00 }
];

// Comprehensive Realistic Medicine Catalog
const DEFAULT_MEDICINES = [
  {
    id: 'MED-101',
    barcode: '890100101',
    brandName: 'Augmentin 625 Duo',
    genericName: 'Amoxicillin (500mg) + Clavulanic Acid (125mg)',
    category: 'Antibiotics',
    dosageForm: 'Tablet',
    strength: '625mg',
    batchNo: 'AUG-8821',
    expiryDate: '2027-08-15',
    rack: 'A-01',
    stock: 85,
    unit: 'Strip of 10',
    costPrice: 8.50,
    mrp: 15.50,
    sellingPrice: 14.00,
    taxRate: 5, // %
    isRxRequired: true,
    reorderLevel: 25,
    supplierId: 'SUP-01'
  },
  {
    id: 'MED-102',
    barcode: '890100102',
    brandName: 'Dolo 650',
    genericName: 'Paracetamol / Acetaminophen',
    category: 'Analgesics & Antipyretics',
    dosageForm: 'Tablet',
    strength: '650mg',
    batchNo: 'DOL-4109',
    expiryDate: '2028-02-20',
    rack: 'A-02',
    stock: 180,
    unit: 'Strip of 15',
    costPrice: 1.20,
    mrp: 3.00,
    sellingPrice: 2.50,
    taxRate: 5,
    isRxRequired: false,
    reorderLevel: 50,
    supplierId: 'SUP-01'
  },
  {
    id: 'MED-103',
    barcode: '890100103',
    brandName: 'Glucophage 500',
    genericName: 'Metformin Hydrochloride',
    category: 'Antidiabetic',
    dosageForm: 'Tablet',
    strength: '500mg',
    batchNo: 'GLU-9901',
    expiryDate: '2027-11-10',
    rack: 'B-01',
    stock: 120,
    unit: 'Strip of 10',
    costPrice: 2.10,
    mrp: 5.00,
    sellingPrice: 4.20,
    taxRate: 5,
    isRxRequired: true,
    reorderLevel: 30,
    supplierId: 'SUP-02'
  },
  {
    id: 'MED-104',
    barcode: '890100104',
    brandName: 'Lipitor 20mg',
    genericName: 'Atorvastatin Calcium',
    category: 'Cardiovascular / Statins',
    dosageForm: 'Tablet',
    strength: '20mg',
    batchNo: 'LIP-2234',
    expiryDate: '2027-05-30',
    rack: 'B-02',
    stock: 95,
    unit: 'Strip of 10',
    costPrice: 3.50,
    mrp: 8.00,
    sellingPrice: 6.80,
    taxRate: 5,
    isRxRequired: true,
    reorderLevel: 25,
    supplierId: 'SUP-02'
  },
  {
    id: 'MED-105',
    barcode: '890100105',
    brandName: 'Pan 40',
    genericName: 'Pantoprazole Gastro-resistant',
    category: 'Gastrointestinal / Antacids',
    dosageForm: 'Tablet',
    strength: '40mg',
    batchNo: 'PAN-7731',
    expiryDate: '2027-09-18',
    rack: 'A-03',
    stock: 140,
    unit: 'Strip of 15',
    costPrice: 2.80,
    mrp: 6.50,
    sellingPrice: 5.50,
    taxRate: 5,
    isRxRequired: false,
    reorderLevel: 40,
    supplierId: 'SUP-01'
  },
  {
    id: 'MED-106',
    barcode: '890100106',
    brandName: 'Zithromax 500',
    genericName: 'Azithromycin Dihydrate',
    category: 'Antibiotics',
    dosageForm: 'Tablet',
    strength: '500mg',
    batchNo: 'ZTH-5512',
    expiryDate: '2027-03-12',
    rack: 'A-01',
    stock: 60,
    unit: 'Strip of 3',
    costPrice: 5.00,
    mrp: 11.00,
    sellingPrice: 9.50,
    taxRate: 5,
    isRxRequired: true,
    reorderLevel: 20,
    supplierId: 'SUP-03'
  },
  {
    id: 'MED-107',
    barcode: '890100107',
    brandName: 'Cozaar 50mg',
    genericName: 'Losartan Potassium',
    category: 'Cardiovascular / Antihypertensive',
    dosageForm: 'Tablet',
    strength: '50mg',
    batchNo: 'COZ-3321',
    expiryDate: '2027-12-05',
    rack: 'B-03',
    stock: 80,
    unit: 'Strip of 14',
    costPrice: 3.00,
    mrp: 7.00,
    sellingPrice: 5.90,
    taxRate: 5,
    isRxRequired: true,
    reorderLevel: 25,
    supplierId: 'SUP-02'
  },
  {
    id: 'MED-108',
    barcode: '890100108',
    brandName: 'Zyrtec 10mg',
    genericName: 'Cetirizine Hydrochloride',
    category: 'Allergy & Antihistamines',
    dosageForm: 'Tablet',
    strength: '10mg',
    batchNo: 'ZYR-1144',
    expiryDate: '2028-04-10',
    rack: 'C-01',
    stock: 210,
    unit: 'Strip of 10',
    costPrice: 0.80,
    mrp: 2.50,
    sellingPrice: 1.90,
    taxRate: 5,
    isRxRequired: false,
    reorderLevel: 50,
    supplierId: 'SUP-01'
  },
  {
    id: 'MED-109',
    barcode: '890100109',
    brandName: 'Ventolin HFA Inhaler',
    genericName: 'Salbutamol / Albuterol Sulfate',
    category: 'Respiratory / Asthma',
    dosageForm: 'Inhaler',
    strength: '100mcg (200 doses)',
    batchNo: 'VEN-6629',
    expiryDate: '2027-10-25',
    rack: 'C-02',
    stock: 35,
    unit: 'Canister',
    costPrice: 6.50,
    mrp: 13.50,
    sellingPrice: 12.00,
    taxRate: 5,
    isRxRequired: true,
    reorderLevel: 15,
    supplierId: 'SUP-03'
  },
  {
    id: 'MED-110',
    barcode: '890100110',
    brandName: 'Brufen 400',
    genericName: 'Ibuprofen',
    category: 'Analgesics & Antipyretics',
    dosageForm: 'Tablet',
    strength: '400mg',
    batchNo: 'BRU-4401',
    expiryDate: '2028-01-14',
    rack: 'A-02',
    stock: 160,
    unit: 'Strip of 15',
    costPrice: 1.50,
    mrp: 3.80,
    sellingPrice: 3.20,
    taxRate: 5,
    isRxRequired: false,
    reorderLevel: 40,
    supplierId: 'SUP-01'
  },
  {
    id: 'MED-111',
    barcode: '890100111',
    brandName: 'Lantus SoloStar Pen',
    genericName: 'Insulin Glargine (rDNA origin)',
    category: 'Cold Chain / Antidiabetic',
    dosageForm: 'Injectable Pen',
    strength: '100 IU/ml (3ml)',
    batchNo: 'LAN-4410',
    expiryDate: '2027-01-15',
    rack: 'Fridge F-1 (2-8°C)',
    stock: 24,
    unit: 'Pre-filled Pen',
    costPrice: 22.00,
    mrp: 38.00,
    sellingPrice: 34.00,
    taxRate: 5,
    isRxRequired: true,
    reorderLevel: 10,
    supplierId: 'SUP-02'
  },
  {
    id: 'MED-112',
    barcode: '890100112',
    brandName: 'Zifi 200 (Near Expiry Demo)',
    genericName: 'Cefixime Trihydrate',
    category: 'Antibiotics',
    dosageForm: 'Tablet',
    strength: '200mg',
    batchNo: 'ZIF-2022',
    expiryDate: '2026-12-05', // Near expiry
    rack: 'A-01',
    stock: 18,
    unit: 'Strip of 10',
    costPrice: 6.00,
    mrp: 13.00,
    sellingPrice: 11.00,
    taxRate: 5,
    isRxRequired: true,
    reorderLevel: 20,
    supplierId: 'SUP-03'
  },
  {
    id: 'MED-113',
    barcode: '890100113',
    brandName: 'Betnovate-C Cream 20g',
    genericName: 'Betamethasone Valerate + Clioquinol',
    category: 'Dermatology / Topicals',
    dosageForm: 'Cream',
    strength: '0.1% w/w',
    batchNo: 'BET-3341',
    expiryDate: '2027-06-25',
    rack: 'D-01',
    stock: 50,
    unit: 'Tube 20g',
    costPrice: 1.90,
    mrp: 4.50,
    sellingPrice: 3.80,
    taxRate: 12,
    isRxRequired: false,
    reorderLevel: 15,
    supplierId: 'SUP-01'
  },
  {
    id: 'MED-114',
    barcode: '890100114',
    brandName: 'Supradyn Daily Multivitamin',
    genericName: 'Multivitamins + Essential Minerals + Zinc',
    category: 'Supplements & OTC',
    dosageForm: 'Tablet',
    strength: 'Therapeutic Formula',
    batchNo: 'SUP-9912',
    expiryDate: '2028-03-30',
    rack: 'D-02',
    stock: 150,
    unit: 'Strip of 15',
    costPrice: 3.00,
    mrp: 6.50,
    sellingPrice: 5.50,
    taxRate: 12,
    isRxRequired: false,
    reorderLevel: 35,
    supplierId: 'SUP-01'
  },
  {
    id: 'MED-115',
    barcode: '890100115',
    brandName: 'Singulair 10mg',
    genericName: 'Montelukast Sodium',
    category: 'Respiratory / Asthma',
    dosageForm: 'Tablet',
    strength: '10mg',
    batchNo: 'SNG-1289',
    expiryDate: '2027-04-18',
    rack: 'C-01',
    stock: 65,
    unit: 'Strip of 10',
    costPrice: 4.20,
    mrp: 9.50,
    sellingPrice: 8.00,
    taxRate: 5,
    isRxRequired: true,
    reorderLevel: 20,
    supplierId: 'SUP-02'
  },
  {
    id: 'MED-116',
    barcode: '890100116',
    brandName: 'Thyronorm 50mcg',
    genericName: 'Levothyroxine Sodium',
    category: 'Endocrinology / Thyroid',
    dosageForm: 'Tablet',
    strength: '50mcg',
    batchNo: 'THY-7719',
    expiryDate: '2027-09-05',
    rack: 'B-01',
    stock: 130,
    unit: 'Bottle of 100',
    costPrice: 2.40,
    mrp: 5.50,
    sellingPrice: 4.80,
    taxRate: 5,
    isRxRequired: true,
    reorderLevel: 30,
    supplierId: 'SUP-02'
  }
];

// Seed Customers / Patients with Credit Balances & Prescriptions
const DEFAULT_CUSTOMERS = [
  {
    id: 'CUST-001',
    name: 'Jonathan Miller',
    phone: '555-0192',
    email: 'j.miller@email.com',
    address: '142 Maplewood Drive, Cityville',
    allergies: 'Penicillin (mild rash)',
    chronicConditions: 'Type 2 Diabetes, Hypertension',
    creditLimit: 500.00,
    balance: 84.50, // owes pharmacy
    notes: 'Long-term patient. Collects Glucophage and Lipitor monthly.'
  },
  {
    id: 'CUST-002',
    name: 'Sarah Jenkins',
    phone: '555-0341',
    email: 'sarah.j@email.com',
    address: '89 Oak Ridge Court, Cityville',
    allergies: 'None reported',
    chronicConditions: 'Bronchial Asthma',
    creditLimit: 300.00,
    balance: 0.00,
    notes: 'Uses Ventolin Inhalers and Montelukast.'
  },
  {
    id: 'CUST-003',
    name: 'Robert Garcia',
    phone: '555-0877',
    email: 'rgarcia@email.com',
    address: '304 Pine Valley St, Cityville',
    allergies: 'Sulfa Drugs',
    chronicConditions: 'Cardiovascular / Post-Stent',
    creditLimit: 600.00,
    balance: 142.00, // owes pharmacy
    notes: 'Prescribed Lipitor 20 and Cozaar 50.'
  },
  {
    id: 'CUST-004',
    name: 'Emily Watson',
    phone: '555-0455',
    email: 'emily.w@email.com',
    address: '77 Birch Ave, Cityville',
    allergies: 'None',
    chronicConditions: 'Hypothyroidism',
    creditLimit: 250.00,
    balance: 28.00,
    notes: 'Monthly Thyronorm.'
  },
  {
    id: 'CUST-000',
    name: 'Walk-In Customer (Cash/POS)',
    phone: 'N/A',
    email: '',
    address: 'Over-the-Counter',
    allergies: '',
    chronicConditions: '',
    creditLimit: 0.00,
    balance: 0.00,
    notes: 'Standard walk-in customer'
  }
];

// Seed Drug Suppliers & Wholesalers
const DEFAULT_SUPPLIERS = [
  {
    id: 'SUP-01',
    name: 'Bagan Pharmaceuticals Distribution',
    contactPerson: 'Alex Turner',
    phone: '555-9100',
    email: 'orders@baganpharma.com',
    address: '400 Industrial Parkway, Metro Hub',
    drugLicenseNo: 'DL-PH-2024-9941',
    taxId: 'TAX-78491-G',
    paymentTerms: 'Net 30',
    balancePayable: 2450.00,
    notes: 'Primary supplier for generic tablets and OTC wellness lines.'
  },
  {
    id: 'SUP-02',
    name: 'MedLife Healthcare Wholesalers',
    contactPerson: 'Brenda Vance',
    phone: '555-8241',
    email: 'supply@medlifewholesale.com',
    address: '12 Logistics Blvd, Suite 400',
    drugLicenseNo: 'DL-PH-2023-4421',
    taxId: 'TAX-55219-M',
    paymentTerms: 'Net 15',
    balancePayable: 1180.00,
    notes: 'Specializes in Chronic care, Insulin cold chain, and Cardiovasculars.'
  },
  {
    id: 'SUP-03',
    name: 'Global Care Pharma & Biologicals',
    contactPerson: 'Charles Roy',
    phone: '555-7302',
    email: 'sales@globalcarepharma.com',
    address: '88 Harbor Tech Plaza',
    drugLicenseNo: 'DL-PH-2025-1298',
    taxId: 'TAX-33120-C',
    paymentTerms: 'Net 45',
    balancePayable: 0.00,
    notes: 'Inhalers, Antibiotics, and Hospital items supplier.'
  }
];

// Seed Initial Journal Entries to populate General Ledger, Trial Balance, P&L, Balance Sheet
const DEFAULT_JOURNAL_ENTRIES = [
  {
    id: 'JRN-1001',
    date: '2026-11-01',
    voucherType: 'Opening Balance',
    reference: 'OB-2026-11',
    narration: 'Opening balances carried forward into modern ledger',
    entries: [
      { accountId: '1010', accountName: 'Cash in Hand (POS Drawer)', debit: 2000.00, credit: 0 },
      { accountId: '1020', accountName: 'Main Bank Account (Operating)', debit: 20000.00, credit: 0 },
      { accountId: '1040', accountName: 'Pharmacy Inventory / Stock Asset', debit: 7500.00, credit: 0 },
      { accountId: '1510', accountName: 'Pharmacy Fixtures, Cold Chain & POS Hardware', debit: 4500.00, credit: 0 },
      { accountId: '3010', accountName: "Owner's Capital / Pharmacy Equity", debit: 0, credit: 25000.00 },
      { accountId: '3020', accountName: 'Retained Earnings', debit: 0, credit: 9000.00 }
    ]
  },
  {
    id: 'JRN-1002',
    date: '2026-11-05',
    voucherType: 'Purchase Voucher',
    reference: 'BILL-BMH-492',
    narration: 'Stock purchase on credit from Bagan Pharmaceuticals',
    supplierId: 'SUP-01',
    entries: [
      { accountId: '1040', accountName: 'Pharmacy Inventory / Stock Asset', debit: 2333.33, credit: 0 },
      { accountId: '2020', accountName: 'Sales Tax / GST Payable', debit: 116.67, credit: 0 }, // Input tax credit
      { accountId: '2010', accountName: 'Accounts Payable (Drug Suppliers)', debit: 0, credit: 2450.00 }
    ]
  },
  {
    id: 'JRN-1003',
    date: '2026-11-08',
    voucherType: 'Purchase Voucher',
    reference: 'BILL-MED-1088',
    narration: 'Stock purchase of Insulin and Cardiacs from MedLife Healthcare',
    supplierId: 'SUP-02',
    entries: [
      { accountId: '1040', accountName: 'Pharmacy Inventory / Stock Asset', debit: 1123.81, credit: 0 },
      { accountId: '2020', accountName: 'Sales Tax / GST Payable', debit: 56.19, credit: 0 },
      { accountId: '2010', accountName: 'Accounts Payable (Drug Suppliers)', debit: 0, credit: 1180.00 }
    ]
  },
  {
    id: 'JRN-1004',
    date: '2026-11-10',
    voucherType: 'Payment Voucher',
    reference: 'CHQ-99012',
    narration: 'Store monthly lease rent paid via bank transfer',
    entries: [
      { accountId: '5020', accountName: 'Store Rent Expense', debit: 800.00, credit: 0 },
      { accountId: '1020', accountName: 'Main Bank Account (Operating)', debit: 0, credit: 800.00 }
    ]
  },
  {
    id: 'JRN-1005',
    date: '2026-11-12',
    voucherType: 'Payment Voucher',
    reference: 'SAL-NOV-W1',
    narration: 'Assistant Pharmacist and technician bi-weekly salaries paid',
    entries: [
      { accountId: '5030', accountName: 'Salaries & Staff Wages', debit: 1100.00, credit: 0 },
      { accountId: '1020', accountName: 'Main Bank Account (Operating)', debit: 0, credit: 1100.00 }
    ]
  },
  {
    id: 'JRN-1006',
    date: '2026-11-14',
    voucherType: 'Payment Voucher',
    reference: 'ELEC-NOV',
    narration: 'Electricity and cold-storage refrigeration power bill',
    entries: [
      { accountId: '5040', accountName: 'Electricity, Cold Chain & Utilities', debit: 215.00, credit: 0 },
      { accountId: '1020', accountName: 'Main Bank Account (Operating)', debit: 0, credit: 215.00 }
    ]
  },
  {
    id: 'JRN-1007',
    date: '2026-11-15',
    voucherType: 'Sales Voucher',
    reference: 'POS-REC-001',
    narration: 'Aggregated Counter POS Sales (Cash & Card) with COGS adjustment',
    entries: [
      { accountId: '1010', accountName: 'Cash in Hand (POS Drawer)', debit: 2100.00, credit: 0 },
      { accountId: '1020', accountName: 'Main Bank Account (Operating)', debit: 2020.00, credit: 0 }, // Card payments settled
      { accountId: '5010', accountName: 'Cost of Goods Sold (COGS)', debit: 2410.00, credit: 0 },
      { accountId: '4030', accountName: 'Sales Discounts Allowed', debit: 85.00, credit: 0 },
      { accountId: '4010', accountName: 'Medicine Sales (Rx & OTC)', debit: 0, credit: 4120.00 },
      { accountId: '4020', accountName: 'Prescription Dispensing & Advisory Fees', debit: 0, credit: 240.00 },
      { accountId: '2020', accountName: 'Sales Tax / GST Payable', debit: 0, credit: 255.00 },
      { accountId: '1040', accountName: 'Pharmacy Inventory / Stock Asset', debit: 0, credit: 2000.00 }
    ]
  },
  {
    id: 'JRN-1008',
    date: '2026-11-16',
    voucherType: 'Sales Voucher',
    reference: 'POS-INV-002',
    narration: 'Credit sales dispensed to regular chronic patients (Receivables)',
    customerId: 'CUST-001',
    entries: [
      { accountId: '1030', accountName: 'Accounts Receivable (Patient Credit)', debit: 254.50, credit: 0 },
      { accountId: '4010', accountName: 'Medicine Sales (Rx & OTC)', debit: 0, credit: 242.38 },
      { accountId: '2020', accountName: 'Sales Tax / GST Payable', debit: 0, credit: 12.12 }
    ]
  },
  {
    id: 'JRN-1009',
    date: '2026-11-17',
    voucherType: 'Journal Voucher',
    reference: 'EXP-LOSS-01',
    narration: 'Quarantine and write-off of damaged and broken vial stock',
    entries: [
      { accountId: '5050', accountName: 'Medicine Expiry, Spoilage & Breakage Loss', debit: 65.00, credit: 0 },
      { accountId: '1040', accountName: 'Pharmacy Inventory / Stock Asset', debit: 0, credit: 65.00 }
    ]
  }
];

// Seed Historical Sales & Invoices
const DEFAULT_SALES = [
  {
    id: 'INV-2026-001',
    invoiceNo: 'RX-1001',
    date: '2026-11-18 10:30',
    customerId: 'CUST-001',
    customerName: 'Jonathan Miller',
    doctorName: 'Dr. Arthur Conan, MD',
    rxNumber: 'RX-9821-C',
    items: [
      { medicineId: 'MED-103', name: 'Glucophage 500', batchNo: 'GLU-9901', expiry: '2027-11-10', quantity: 2, unitPrice: 4.20, taxRate: 5, total: 8.40 },
      { medicineId: 'MED-104', name: 'Lipitor 20mg', batchNo: 'LIP-2234', expiry: '2027-05-30', quantity: 1, unitPrice: 6.80, taxRate: 5, total: 6.80 }
    ],
    subtotal: 15.20,
    discountAmount: 1.00,
    taxAmount: 0.71,
    grandTotal: 14.91,
    paymentMethod: 'Credit / Ledger',
    amountPaid: 0.00,
    changeGiven: 0.00,
    notes: 'Prescription verified. Added to patient monthly account.'
  },
  {
    id: 'INV-2026-002',
    invoiceNo: 'OTC-1002',
    date: '2026-11-18 11:15',
    customerId: 'CUST-000',
    customerName: 'Walk-In Customer (Cash/POS)',
    doctorName: '',
    rxNumber: '',
    items: [
      { medicineId: 'MED-102', name: 'Dolo 650', batchNo: 'DOL-4109', expiry: '2028-02-20', quantity: 3, unitPrice: 2.50, taxRate: 5, total: 7.50 },
      { medicineId: 'MED-114', name: 'Supradyn Daily Multivitamin', batchNo: 'SUP-9912', expiry: '2028-03-30', quantity: 1, unitPrice: 5.50, taxRate: 12, total: 5.50 }
    ],
    subtotal: 13.00,
    discountAmount: 0.00,
    taxAmount: 1.04,
    grandTotal: 14.04,
    paymentMethod: 'Cash',
    amountPaid: 20.00,
    changeGiven: 5.96,
    notes: 'Cash Sale'
  }
];

// Seed Staff Accounts & Permissions Management
const DEFAULT_STAFF = [
  {
    id: 'staff_dev',
    username: 'developer',
    aliases: ['dev', 'dev@baganmedicalhall.com', 'admin'],
    password: 'dev123',
    name: 'Dev Kumar Rajbanshi',
    role: 'developer',
    roleTitle: 'Lead Developer & Super Admin',
    email: 'dev@baganmedicalhall.com',
    phone: '+977-9800000000',
    status: 'active',
    avatar: '💻',
    permissions: {
      pos: true,
      applyDiscounts: true,
      inventory: true,
      expiryWriteOff: true,
      patientLedger: true,
      supplierLedger: true,
      journalEntries: true,
      financialReports: true,
      medicationTreatment: true,
      dailyRecords: true,
      expenses: true,
      backup: true,
      settings: true,
      devTools: true
    }
  },
  {
    id: 'staff_pharmacist_1',
    username: 'pharmacist',
    aliases: ['user', 'staff', 'sarah', 'user@baganmedicalhall.com'],
    password: 'user123',
    name: 'Sarah Jenkins, RPh',
    role: 'pharmacist',
    roleTitle: 'Staff Pharmacist',
    email: 'sarah.j@baganmedicalhall.com',
    phone: '555-0341',
    status: 'active',
    avatar: '🧑‍⚕️',
    permissions: {
      pos: true,
      applyDiscounts: true,
      medicationTreatment: true,
      dailyRecords: true,
      expenses: true,
      inventory: true,
      expiryWriteOff: true,
      patientLedger: true,
      supplierLedger: true,
      journalEntries: false,
      financialReports: false,
      backup: false,
      settings: false,
      devTools: false
    }
  }
];

// Preloaded Media Center Items
const DEFAULT_COLORED_LOGO_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+CiAgPCEtLSBDb2xvdXJlZCBQaGFybWFjeSBMb2dvOiBPcHRpbWl6ZWQgZm9yIExpZ2h0IEJhY2tncm91bmRzIChSZWNlaXB0cywgV2hpdGUgQ2FyZHMpIC0tPgogIDxwYXRoIGQ9Ik00MiA4IEg1OCBWMjQgSDc0IFY0MCBINTggVjU2IEg0MiBWNDAgSDI2IFYyNCBINDIgWiIgZmlsbD0iIzAyODRjNyIgZmlsbC1vcGFjaXR5PSIwLjE4IiAvPgogIDxwYXRoIGQ9Ik0yNiA4NCBWMjQgSDQ4IEM2MCAyNCA2OCAzMSA2OCA0MSBDNjggNTEgNjAgNTggNDggNTggSDI2IE00NCA1OCBMNjggODQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAyODRjNyIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIC8+CiAgPGxpbmUgeDE9IjYwIiB5MT0iNjIiIHgyPSI4MiIgeTI9Ijg0IiBzdHJva2U9IiMwZjc2NmUiIHN0cm9rZS13aWR0aD0iOSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPgogIDxsaW5lIHgxPSI4MiIgeTE9IjYyIiB4Mj0iNjAiIHkyPSI4NCIgc3Ryb2tlPSIjMGY3NjZlIiBzdHJva2Utd2lkdGg9IjkiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9zdmc+Cg==';

const DEFAULT_WHITE_LOGO_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+CiAgPCEtLSBXaGl0ZSBQaGFybWFjeSBMb2dvOiBPcHRpbWl6ZWQgZm9yIERhcmsgQmFja2dyb3VuZHMgKFNpZGViYXIsIERhcmsgSGVhZGVycykgLS0+CiAgPHBhdGggZD0iTTQyIDggSDU4IFYyNCBINzQgVjQwIEg1OCBWNTYgSDQyIFY0MCBIMjYgVjI0IEg0MiBaIiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMjUiIC8+CiAgPHBhdGggZD0iTTI2IDg0IFYyNCBINDggQzYwIDI0IDY4IDMxIDY4IDQxIEM2OCA1MSA2MCA1OCA0OCA1OCBIMjYgTTQ0IDU4IEw2OCA4NCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjkiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgLz4KICA8bGluZSB4MT0iNjAiIHkxPSI2MiIgeDI9IjgyIiB5Mj0iODQiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIwLjg1IiAvPgogIDxsaW5lIHgxPSI4MiIgeTE9IjYyIiB4Mj0iNjAiIHkyPSI4NCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjkiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLW9wYWNpdHk9IjAuODUiIC8+Cjwvc3ZnPgo=';

const DEFAULT_FALLBACK_LOGO_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+CiAgPCEtLSBGYWxsYmFjayBFbWJsZW06IENhZHVjZXVzIC8gUnggQ3Jvc3MgTWluaW1hbCAtLT4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDI4NGM3IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1kYXNoYXJyYXk9IjYsNCIgLz4KICA8cGF0aCBkPSJNNDQgMjYgSDU2IFY0NCBINzQgVjU2IEg1NiBWNzQgSDQ0IFY1NiBIMjYgVjQ0IEg0NCBaIiBmaWxsPSIjMDI4NGM3IiAvPgo8L3N2Zz4K';

const DEFAULT_MEDIA_LIBRARY = [
  {
    id: 'med_default_colored',
    filename: 'default-logo-colored.svg',
    path: 'website_images/default-logo-colored.svg',
    dataUrl: DEFAULT_COLORED_LOGO_DATA_URI,
    size: 824,
    uploadedAt: 'Preloaded',
    title: 'Default Coloured Logo (For Light Backgrounds)'
  },
  {
    id: 'med_default_white',
    filename: 'default-logo-white.svg',
    path: 'website_images/default-logo-white.svg',
    dataUrl: DEFAULT_WHITE_LOGO_DATA_URI,
    size: 790,
    uploadedAt: 'Preloaded',
    title: 'Default White Logo (For Dark Backgrounds)'
  },
  {
    id: 'med_default_fallback',
    filename: 'default-logo-fallback.svg',
    path: 'website_images/default-logo-fallback.svg',
    dataUrl: DEFAULT_FALLBACK_LOGO_DATA_URI,
    size: 450,
    uploadedAt: 'Preloaded',
    title: 'Default Fallback Logo'
  }
];

// Preloaded Pharmacy Clinical Treatments & Medication Administration
const DEFAULT_TREATMENTS = [
  {
    id: 'TRT-1001',
    treatmentNo: 'TRT-2026-01',
    date: '2026-11-20',
    time: '09:45 AM',
    patientId: 'CUST-001',
    patientName: 'Jonathan Miller',
    patientPhone: '+1 (555) 234-8901',
    doctorName: 'Dr. Sarah Lin, MD (Pulmonologist)',
    treatmentType: 'Nebulization Therapy',
    medicationUsed: 'Salbutamol 2.5mg Respules',
    dosageRoute: '2.5mg via Oxygen-Driven Jet Nebulizer',
    vitals: 'BP: 124/82 | SpO2: 98% | Pulse: 78 bpm',
    chargeAmount: 25.00,
    status: 'Administered',
    clinicalNotes: 'Patient felt marked relief from acute bronchospasm. No tremors or tachycardia observed.',
    administeredBy: 'Sarah Jenkins, RPh'
  },
  {
    id: 'TRT-1002',
    treatmentNo: 'TRT-2026-02',
    date: '2026-11-20',
    time: '11:15 AM',
    patientId: 'CUST-002',
    patientName: 'Emily Watson',
    patientPhone: '+1 (555) 876-5432',
    doctorName: 'Dr. James Thorne, MBBS',
    treatmentType: 'Sterile Wound Dressing & Antiseptic Care',
    medicationUsed: 'Povidone Iodine 10% Solution + Sterile Gauze Roll',
    dosageRoute: 'Topical Debridement & Sterile Bandaging',
    vitals: 'Temp: 98.4°F | Clean surgical margin',
    chargeAmount: 18.00,
    status: 'Administered',
    clinicalNotes: 'Cleaned superficial laceration on right forearm. Applied sterile hydrogel. Advised to keep dry for 48 hours.',
    administeredBy: 'Sarah Jenkins, RPh'
  },
  {
    id: 'TRT-1003',
    treatmentNo: 'TRT-2026-03',
    date: '2026-11-20',
    time: '02:30 PM',
    patientId: 'CUST-003',
    patientName: 'Robert Sterling',
    patientPhone: '+1 (555) 432-1098',
    doctorName: 'Dr. Anita Desai, MD (Endocrinologist)',
    treatmentType: 'Insulin Administration & Glucose Profiling',
    medicationUsed: 'Insulin Glargine (Lantus) 100 IU/mL',
    dosageRoute: '14 Units Subcutaneous (Abdominal)',
    vitals: 'Pre-dose Fasting Blood Sugar: 142 mg/dL',
    chargeAmount: 15.00,
    status: 'Scheduled',
    clinicalNotes: 'Evening basal dose verification. Patient counseled on injection site rotation and hypoglycemia warning signs.',
    administeredBy: 'Sarah Jenkins, RPh'
  }
];

// Preloaded Pharmacy Operating Expenses
const DEFAULT_EXPENSES = [
  {
    id: 'EXP-1001',
    voucherNo: 'VCH-2026-01',
    date: '2026-11-19',
    category: 'Electricity, Cold Chain & Utilities',
    amount: 145.00,
    paymentMethod: 'Cash from Drawer',
    paidTo: 'Metropolitan Electricity Board',
    description: 'Pharmacy vaccine cold-chain refrigerator & main dispensary power bill',
    recordedBy: 'Sarah Jenkins, RPh',
    createdAt: '2026-11-19T10:30:00Z'
  },
  {
    id: 'EXP-1002',
    voucherNo: 'VCH-2026-02',
    date: '2026-11-20',
    category: 'Packaging, Prescription Bags & Labels',
    amount: 45.00,
    paymentMethod: 'Cash from Drawer',
    paidTo: 'MediPack Dispensary Supplies Co.',
    description: 'Dispensing vials, amber prescription bottles & thermal receipt paper rolls',
    recordedBy: 'Sarah Jenkins, RPh',
    createdAt: '2026-11-20T09:15:00Z'
  },
  {
    id: 'EXP-1003',
    voucherNo: 'VCH-2026-03',
    date: '2026-11-20',
    category: 'General Dispensary Operating Expenses',
    amount: 35.00,
    paymentMethod: 'Bank / Online / QR',
    paidTo: 'CleanCare Clinical Sanitation',
    description: 'Daily pharmacy aseptic counter sterilization & biohazard containment bags',
    recordedBy: 'Sarah Jenkins, RPh',
    createdAt: '2026-11-20T11:00:00Z'
  }
];

// Seed Daily Drawer Closing Shifts (Yesterday's Final Closing = Today's Opening)
const DEFAULT_DAILY_DRAWER_CLOSINGS = {
  '2026-11-19': {
    date: '2026-11-19',
    openingBalance: 1200.00,
    cashSales: 680.00,
    cashExpenses: 145.00,
    netCashCollection: 535.00,
    onlineCollection: 310.00,
    finalClosingBalance: 1735.00, // 1200 + 535 = $1,735.00
    status: 'Closed',
    closedBy: 'Sarah Jenkins, RPh',
    closedAt: '2026-11-19T21:00:00Z',
    notes: 'Shift closed without cash discrepancies. Drawer reconciled perfectly.'
  }
};

// Universal (Global) Pharmacy Information - Editable in Developer Hub
const DEFAULT_GLOBAL_SETTINGS = {
  name: 'Bagan Medical Hall',
  contacts: '+1 (555) 342-8800 | admin.baganmedicalhall@gmail.com',
  phone: '+1 (555) 342-8800',
  email: 'admin.baganmedicalhall@gmail.com',
  address: '104 Healthcare Avenue, Medical District, Suite 101',
  tagline: 'Your Trusted Pharmacy & Clinical Dispensary',
  logo: 'BMH', // text emblem
  logoType: 'image', // 'image' or 'text'
  logoColored: 'website_images/default-logo-colored.svg', // Coloured logo for light backgrounds (receipts, white card)
  logoColoredData: DEFAULT_COLORED_LOGO_DATA_URI,
  logoWhite: 'website_images/default-logo-white.svg', // White logo for dark backgrounds (sidebar)
  logoWhiteData: DEFAULT_WHITE_LOGO_DATA_URI,
  fallbackLogoImage: 'website_images/default-logo-fallback.svg', // Image for fallback logo
  fallbackLogoData: DEFAULT_FALLBACK_LOGO_DATA_URI,
  fallbackType: 'image', // 'image' or 'text'
  logoImage: 'website_images/default-logo-colored.svg', // legacy alias
  logoData: DEFAULT_COLORED_LOGO_DATA_URI,
  primaryColor: '#0284c7',
  secondaryColor: '#0f766e',
  greetingMessage: 'Welcome to Bagan Medical Hall. Please verify temperature logs and prescriptions carefully.'
};

// Developer Editable Settings for Login Page & Staff UI
const DEFAULT_LOGIN_PAGE_SETTINGS = {
  brandName: 'Bagan Medical Hall',
  tagline: 'Your Trusted Pharmacy & Clinical Dispensary',
  announcement: 'Welcome to Bagan Medical Hall. Please verify temperature logs and prescriptions carefully.',
  logoText: 'BMH',
  logoImage: 'website_images/default-logo.svg',
  logoType: 'image',
  showTestCredentials: false,
  primaryColor: '#0284c7',
  secondaryColor: '#0f766e',
  accentColor: '#0284c7'
};

const DEFAULT_STAFF_UI_SETTINGS = {
  appTitle: 'Bagan Medical Hall',
  defaultView: 'pos',
  maxDiscountPercent: 15,
  requireDoctorForRx: true,
  thermalReceiptFooter: 'Thank you for choosing Bagan Medical Hall!',
  enableHoldTickets: true
};

// Preloaded Master Product Categories
const DEFAULT_PRODUCT_CATEGORIES = [
  { id: 'CAT-01', name: 'Antibiotics', description: 'Anti-infective antibacterial medications', color: '#0284c7', isDefault: true },
  { id: 'CAT-02', name: 'Analgesics & Antipyretics', description: 'Pain relief and fever reducers', color: '#10b981', isDefault: true },
  { id: 'CAT-03', name: 'Antidiabetic', description: 'Insulin, oral hypoglycemics and glucose management', color: '#f59e0b', isDefault: true },
  { id: 'CAT-04', name: 'Cardiovascular', description: 'Antihypertensives, statins and cardiac therapy', color: '#ef4444', isDefault: true },
  { id: 'CAT-05', name: 'Gastrointestinal', description: 'Antacids, PPIs, antiemetics and gut motility', color: '#8b5cf6', isDefault: true },
  { id: 'CAT-06', name: 'Respiratory', description: 'Bronchodilators, inhalers and cough therapeutics', color: '#06b6d4', isDefault: true },
  { id: 'CAT-07', name: 'Supplements & OTC', description: 'Vitamins, minerals, wellness and nutrition', color: '#84cc16', isDefault: true },
  { id: 'CAT-08', name: 'Dermatology', description: 'Topical creams, ointments and skin care', color: '#ec4899', isDefault: true },
  { id: 'CAT-09', name: 'Cold Chain & Biologicals', description: 'Temperature-sensitive vaccines and biologicals', color: '#3b82f6', isDefault: true },
  { id: 'CAT-10', name: 'Allergy & Antihistamines', description: 'Antihistamines and decongestants', color: '#14b8a6', isDefault: true }
];

// Preloaded Product Expense Categories
const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'EXPCAT-01', name: 'Utilities', description: 'Electricity, cold chain power, water & internet', defaultAccount: '5040', isDefault: true },
  { id: 'EXPCAT-02', name: 'Dispensary Supplies', description: 'Syringes, gauze, gloves & clinical disposables', defaultAccount: '5090', isDefault: true },
  { id: 'EXPCAT-03', name: 'Rent & Premises', description: 'Store lease, building maintenance & facility charges', defaultAccount: '5020', isDefault: true },
  { id: 'EXPCAT-04', name: 'Staff Welfare & Wages', description: 'Staff salaries, overtime and dispensary staff refreshments', defaultAccount: '5030', isDefault: true },
  { id: 'EXPCAT-05', name: 'Maintenance & Repairs', description: 'Equipment upkeep, air conditioning and fridge servicing', defaultAccount: '5090', isDefault: true },
  { id: 'EXPCAT-06', name: 'Marketing & Printing', description: 'Flyers, health promotion and patient stationery', defaultAccount: '5090', isDefault: true },
  { id: 'EXPCAT-07', name: 'License & Regulatory', description: 'Pharmacy board fees, municipal permits and inspections', defaultAccount: '5060', isDefault: true },
  { id: 'EXPCAT-08', name: 'Logistics & Courier', description: 'Wholesaler inward logistics and prescription home delivery', defaultAccount: '5090', isDefault: true },
  { id: 'EXPCAT-09', name: 'Packaging, Bags & Labels', description: 'Dispensing envelopes, amber vials and barcode labels', defaultAccount: '5070', isDefault: true },
  { id: 'EXPCAT-10', name: 'Other Operating Expenses', description: 'Sundry administrative and miscellaneous retail expenses', defaultAccount: '5090', isDefault: true }
];

// Preloaded Dosages Forms
const DEFAULT_DOSAGE_FORMS = [
  { id: 'DF-01', name: 'Tablet', code: 'TAB', description: 'Solid compressed oral dosage form', isDefault: true },
  { id: 'DF-02', name: 'Capsule', code: 'CAP', description: 'Gelatin shell enclosing active ingredients', isDefault: true },
  { id: 'DF-03', name: 'Syrup / Liquid', code: 'SYR', description: 'Viscous oral sugar or sorbitol solution', isDefault: true },
  { id: 'DF-04', name: 'Injection / Pen', code: 'INJ', description: 'Sterile injectable solution or prefilled pen', isDefault: true },
  { id: 'DF-05', name: 'Inhaler', code: 'INH', description: 'Metered dose or dry powder inhalation aerosol', isDefault: true },
  { id: 'DF-06', name: 'Cream / Ointment', code: 'CRM', description: 'Topical semi-solid dermatological emulsion', isDefault: true },
  { id: 'DF-07', name: 'Eye / Ear Drops', code: 'DRP', description: 'Sterile ophthalmic or otic aqueous solution', isDefault: true },
  { id: 'DF-08', name: 'Suppository', code: 'SUP', description: 'Solid rectal or vaginal meltable insertion', isDefault: true },
  { id: 'DF-09', name: 'Suspension / Solution', code: 'SUSP', description: 'Liquid dispersion requiring shaking before use', isDefault: true },
  { id: 'DF-10', name: 'Powder / Sachet', code: 'PWD', description: 'Dry granules or effervescent reconstitution packet', isDefault: true }
];

// Preloaded Procedure / Treatment Types *
const DEFAULT_TREATMENT_TYPES = [
  { id: 'TT-01', name: 'Nebulization Therapy', defaultCharge: 15.00, description: 'Respiratory bronchodilator aerosol nebulization treatment', isDefault: true },
  { id: 'TT-02', name: 'Sterile Wound Dressing', defaultCharge: 20.00, description: 'Aseptic wound debridement, cleaning and sterile bandaging', isDefault: true },
  { id: 'TT-03', name: 'Insulin Administration & BSL Check', defaultCharge: 10.00, description: 'Blood sugar capillary profiling and subcutaneous insulin dose', isDefault: true },
  { id: 'TT-04', name: 'IV Cannulation & Infusion', defaultCharge: 35.00, description: 'Peripheral vein cannula placement and IV drip administration', isDefault: true },
  { id: 'TT-05', name: 'Intramuscular (IM) Injection', defaultCharge: 12.00, description: 'Deep muscle parenteral drug delivery (deltoid / gluteal)', isDefault: true },
  { id: 'TT-06', name: 'Vaccination / Immunization', defaultCharge: 18.00, description: 'Preventive vaccine administration and immunization card update', isDefault: true },
  { id: 'TT-07', name: 'Vitals Monitoring & Observation', defaultCharge: 10.00, description: 'BP, heart rate, pulse oximetry SpO2 & temperature chart', isDefault: true },
  { id: 'TT-08', name: 'General Clinical Procedure', defaultCharge: 15.00, description: 'General dispensary nurse or clinical pharmacist intervention', isDefault: true }
];

// Preloaded Administration Routes
const DEFAULT_ADMIN_ROUTES = [
  { id: 'AR-01', name: 'Oral', code: 'PO', description: 'Per os / swallowing by mouth', isDefault: true },
  { id: 'AR-02', name: 'Intravenous (IV)', code: 'IV', description: 'Direct injection into venous bloodstream', isDefault: true },
  { id: 'AR-03', name: 'Intramuscular (IM)', code: 'IM', description: 'Injection into deep muscle tissue', isDefault: true },
  { id: 'AR-04', name: 'Subcutaneous (SC)', code: 'SC', description: 'Injection into fatty tissue beneath skin', isDefault: true },
  { id: 'AR-05', name: 'Inhalation', code: 'INH', description: 'Aerosol breath intake via lungs / nebulizer', isDefault: true },
  { id: 'AR-06', name: 'Topical / Dressing', code: 'TOP', description: 'Application on cutaneous skin or open wound surface', isDefault: true },
  { id: 'AR-07', name: 'Sublingual', code: 'SL', description: 'Rapid dissolving under the tongue', isDefault: true },
  { id: 'AR-08', name: 'Ophthalmic', code: 'OPH', description: 'Instillation into conjunctival eye sac', isDefault: true },
  { id: 'AR-09', name: 'Otic', code: 'OT', description: 'Instillation into external ear canal', isDefault: true }
];

// Preloaded Status Options *
const DEFAULT_STATUS_OPTIONS = [
  // Clinical / Treatment Statuses
  { id: 'ST-01', name: 'Administered', scope: 'treatment', label: 'Administered (Completed)', badgeColor: '#10b981', textColor: '#ffffff', isDefault: true },
  { id: 'ST-02', name: 'In-Progress', scope: 'treatment', label: 'In-Progress (Ongoing)', badgeColor: '#f59e0b', textColor: '#ffffff', isDefault: false },
  { id: 'ST-03', name: 'Scheduled', scope: 'treatment', label: 'Scheduled (Pending)', badgeColor: '#6366f1', textColor: '#ffffff', isDefault: false },
  { id: 'ST-04', name: 'Cancelled', scope: 'treatment', label: 'Cancelled / Abandoned', badgeColor: '#ef4444', textColor: '#ffffff', isDefault: false },

  // Inventory / Product Statuses
  { id: 'ST-05', name: 'In Stock', scope: 'inventory', label: 'In Stock / Active', badgeColor: '#10b981', textColor: '#ffffff', isDefault: true },
  { id: 'ST-06', name: 'Low Stock', scope: 'inventory', label: 'Low Stock Reorder Alert', badgeColor: '#f59e0b', textColor: '#ffffff', isDefault: false },
  { id: 'ST-07', name: 'Out of Stock', scope: 'inventory', label: 'Out of Stock / Depleted', badgeColor: '#ef4444', textColor: '#ffffff', isDefault: false },
  { id: 'ST-08', name: 'Discontinued', scope: 'inventory', label: 'Discontinued / Retired', badgeColor: '#64748b', textColor: '#ffffff', isDefault: false }
];

// Preloaded Tax System Configuration & Brackets
const DEFAULT_TAX_SETTINGS = {
  enabled: true,
  taxName: 'VAT',
  regNumber: 'VAT-9021-RX',
  defaultRate: 13,
  calculationMethod: 'exclusive',
  taxDisclosure: 'All prices subject to statutory VAT regulations.',
  slabs: [
    { id: 'TAX-0', name: 'Tax Exempt (0%)', rate: 0, description: 'Exempt life-saving medications & vaccines', isDefault: false },
    { id: 'TAX-5', name: 'Essential Medicines (5%)', rate: 5, description: 'Reduced tax tier for scheduled essential drugs', isDefault: false },
    { id: 'TAX-13', name: 'Standard VAT (13%)', rate: 13, description: 'Standard statutory VAT rate for medicines', isDefault: true },
    { id: 'TAX-18', name: 'Medical Devices & Diagnostics (18%)', rate: 18, description: 'Medical equipment, diagnostic kits & cosmetics', isDefault: false },
    { id: 'TAX-28', name: 'Luxury & Cosmetic Formulations (28%)', rate: 28, description: 'Premium healthcare & cosmetic imports', isDefault: false }
  ]
};

// Preloaded Customer Credit Collections (Receipts)
const DEFAULT_CREDIT_COLLECTIONS = [
  {
    id: 'CR-COL-1001',
    receiptNo: 'REC-2026-01',
    date: '2026-11-20',
    time: '10:15 AM',
    customerId: 'CUST-001',
    customerName: 'Eleanor Vance',
    customerPhone: '+1 (555) 234-5678',
    amount: 65.00,
    paymentMode: 'Cash',
    isCashDrawer: true,
    narration: 'Chronic diabetes monthly credit clearance (Cash in Drawer)',
    recordedBy: 'Sarah Jenkins, RPh',
    status: 'Collected',
    createdAt: '2026-11-20T10:15:00Z'
  },
  {
    id: 'CR-COL-1002',
    receiptNo: 'REC-2026-02',
    date: '2026-11-20',
    time: '01:45 PM',
    customerId: 'CUST-002',
    customerName: 'Marcus Brody',
    customerPhone: '+1 (555) 876-5432',
    amount: 40.00,
    paymentMode: 'Bank / Online / QR',
    isCashDrawer: false,
    narration: 'Hypertension prescription clearance (Direct QR Bank Transfer)',
    recordedBy: 'Sarah Jenkins, RPh',
    status: 'Collected',
    createdAt: '2026-11-20T13:45:00Z'
  }
];

/* -------------------------------------------------------------
 * BAGAN MEDIA STORE - Resilient IndexedDB Binary/Image Database
 * Stores high-res images, data URLs, and blobs persistently
 * with zero size constraints across all browsers and file:// protocol.
 * ------------------------------------------------------------- */
const BaganMediaStore = {
  dbName: 'BaganMedicalHallMediaDB',
  storeName: 'media_files',
  db: null,

  async openDB() {
    if (this.db) return this.db;
    return new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'filename' });
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  },

  async saveMedia(item) {
    if (!item || !item.filename) return;
    try {
      const db = await this.openDB();
      if (!db) {
        if (item.dataUrl && item.dataUrl.length < 500000) {
          try { localStorage.setItem('bmh_img_' + item.filename, item.dataUrl); } catch (_) {}
        }
        return;
      }
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put(item);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (_) {}
  },

  async getMedia(filename) {
    if (!filename) return null;
    try {
      const db = await this.openDB();
      if (!db) {
        const fb = localStorage.getItem('bmh_img_' + filename);
        return fb ? { filename, dataUrl: fb } : null;
      }
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(filename);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (_) {
      return null;
    }
  },

  async getAllMedia() {
    try {
      const db = await this.openDB();
      if (!db) return [];
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (_) {
      return [];
    }
  },

  async deleteMedia(filename) {
    if (!filename) return;
    try {
      const db = await this.openDB();
      if (db) {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).delete(filename);
      }
      try { localStorage.removeItem('bmh_img_' + filename); } catch (_) {}
    } catch (_) {}
  }
};

class PharmacyDatabase {
  constructor() {
    this.data = this.loadData();
    this.recalculateAllAccountBalances();
    this.hydrateMediaLibrary();
    try { this.save(); } catch (e) {}
  }

  async hydrateMediaLibrary() {
    try {
      const stored = await BaganMediaStore.getAllMedia();
      if (stored && stored.length > 0) {
        if (!this.data.mediaLibrary) this.data.mediaLibrary = [];
        stored.forEach(img => {
          const idx = this.data.mediaLibrary.findIndex(m => m.filename === img.filename);
          if (idx > -1) {
            if (img.dataUrl) this.data.mediaLibrary[idx].dataUrl = img.dataUrl;
          } else {
            this.data.mediaLibrary.unshift(img);
          }
          // Hydrate global settings logo dataUrls if matching
          const g = this.data.globalSettings;
          if (g && img.dataUrl) {
            if (g.logoColored === img.path || g.logoColored === img.filename) {
              g.logoColoredData = img.dataUrl;
              try { localStorage.setItem('bmh_active_logo_colored', img.dataUrl); } catch (_) {}
            }
            if (g.logoWhite === img.path || g.logoWhite === img.filename) {
              g.logoWhiteData = img.dataUrl;
              try { localStorage.setItem('bmh_active_logo_white', img.dataUrl); } catch (_) {}
            }
            if (g.fallbackLogoImage === img.path || g.fallbackLogoImage === img.filename) {
              g.fallbackLogoData = img.dataUrl;
              try { localStorage.setItem('bmh_active_logo_fallback', img.dataUrl); } catch (_) {}
            }
          }
        });
      }
    } catch (_) {}
  }

  loadData() {
    try {
      const stored = localStorage.getItem(DB_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.globalSettings) {
          parsed.globalSettings = JSON.parse(JSON.stringify(DEFAULT_GLOBAL_SETTINGS));
        } else {
          // Automatic migration of legacy name to Bagan Medical Hall
          if (!parsed.globalSettings.name || parsed.globalSettings.name.includes('Apex')) {
            parsed.globalSettings.name = 'Bagan Medical Hall';
          }
          if (parsed.globalSettings.email && parsed.globalSettings.email.includes('apexhealthrx')) {
            parsed.globalSettings.email = 'admin.baganmedicalhall@gmail.com';
            parsed.globalSettings.contacts = '+1 (555) 342-8800 | admin.baganmedicalhall@gmail.com';
          }
          if (parsed.globalSettings.greetingMessage && parsed.globalSettings.greetingMessage.includes('Apex')) {
            parsed.globalSettings.greetingMessage = 'Welcome to Bagan Medical Hall. Please verify temperature logs and prescriptions carefully.';
          }
          if (!parsed.globalSettings.primaryColor) parsed.globalSettings.primaryColor = '#0284c7';
          if (!parsed.globalSettings.secondaryColor) parsed.globalSettings.secondaryColor = '#0f766e';
          if (!parsed.globalSettings.logoColored) parsed.globalSettings.logoColored = 'website_images/default-logo-colored.svg';
          if (!parsed.globalSettings.logoWhite) parsed.globalSettings.logoWhite = 'website_images/default-logo-white.svg';
          if (!parsed.globalSettings.fallbackLogoImage) parsed.globalSettings.fallbackLogoImage = 'website_images/default-logo-fallback.svg';
          if (!parsed.globalSettings.fallbackType) parsed.globalSettings.fallbackType = 'image';
          if (!parsed.globalSettings.logoImage) parsed.globalSettings.logoImage = parsed.globalSettings.logoColored;
          if (!parsed.globalSettings.logoType) parsed.globalSettings.logoType = 'image';

                    // Sanitize any corrupted utf8 data URIs from previous versions
          if (parsed.globalSettings.logoColoredData && (parsed.globalSettings.logoColoredData.indexOf('utf8') > -1 || parsed.globalSettings.logoColoredData.indexOf('<svg') > -1)) {
            parsed.globalSettings.logoColoredData = DEFAULT_COLORED_LOGO_DATA_URI;
          }
          if (parsed.globalSettings.logoWhiteData && (parsed.globalSettings.logoWhiteData.indexOf('utf8') > -1 || parsed.globalSettings.logoWhiteData.indexOf('<svg') > -1)) {
            parsed.globalSettings.logoWhiteData = DEFAULT_WHITE_LOGO_DATA_URI;
          }
          if (parsed.globalSettings.fallbackLogoData && (parsed.globalSettings.fallbackLogoData.indexOf('utf8') > -1 || parsed.globalSettings.fallbackLogoData.indexOf('<svg') > -1)) {
            parsed.globalSettings.fallbackLogoData = DEFAULT_FALLBACK_LOGO_DATA_URI;
          }
          // Ensure logo dataUrls are NEVER lost on page refresh & completely sanitized
          let cachedCol = localStorage.getItem('bmh_active_logo_colored');
          if (cachedCol && (cachedCol.indexOf('utf8') > -1 || cachedCol.indexOf('<svg') > -1)) {
            cachedCol = DEFAULT_COLORED_LOGO_DATA_URI;
            try { localStorage.setItem('bmh_active_logo_colored', cachedCol); } catch (_) {}
          }
          let cachedWhite = localStorage.getItem('bmh_active_logo_white');
          if (cachedWhite && (cachedWhite.indexOf('utf8') > -1 || cachedWhite.indexOf('<svg') > -1)) {
            cachedWhite = DEFAULT_WHITE_LOGO_DATA_URI;
            try { localStorage.setItem('bmh_active_logo_white', cachedWhite); } catch (_) {}
          }
          let cachedFb = localStorage.getItem('bmh_active_logo_fallback');
          if (cachedFb && (cachedFb.indexOf('utf8') > -1 || cachedFb.indexOf('<svg') > -1)) {
            cachedFb = DEFAULT_FALLBACK_LOGO_DATA_URI;
            try { localStorage.setItem('bmh_active_logo_fallback', cachedFb); } catch (_) {}
          }

          if (!parsed.globalSettings.logoColoredData || parsed.globalSettings.logoColoredData.indexOf('utf8') > -1 || parsed.globalSettings.logoColoredData.indexOf('<svg') > -1) {
            parsed.globalSettings.logoColoredData = cachedCol || DEFAULT_COLORED_LOGO_DATA_URI;
          }
          if (!parsed.globalSettings.logoWhiteData || parsed.globalSettings.logoWhiteData.indexOf('utf8') > -1 || parsed.globalSettings.logoWhiteData.indexOf('<svg') > -1) {
            parsed.globalSettings.logoWhiteData = cachedWhite || DEFAULT_WHITE_LOGO_DATA_URI;
          }
          if (!parsed.globalSettings.fallbackLogoData || parsed.globalSettings.fallbackLogoData.indexOf('utf8') > -1 || parsed.globalSettings.fallbackLogoData.indexOf('<svg') > -1) {
            parsed.globalSettings.fallbackLogoData = cachedFb || DEFAULT_FALLBACK_LOGO_DATA_URI;
          }
          parsed.globalSettings.logoData = parsed.globalSettings.logoColoredData;
        }
        if (!parsed.mediaLibrary || !Array.isArray(parsed.mediaLibrary)) {
          parsed.mediaLibrary = JSON.parse(JSON.stringify(DEFAULT_MEDIA_LIBRARY));
        } else {
          DEFAULT_MEDIA_LIBRARY.forEach(def => {
            if (!parsed.mediaLibrary.some(m => m.filename === def.filename)) {
              parsed.mediaLibrary.unshift(def);
            }
          });
        }
        if (!parsed.staffMembers || parsed.staffMembers.length === 0) {
          parsed.staffMembers = JSON.parse(JSON.stringify(DEFAULT_STAFF));
        } else {
          // Remove legacy cashier if exists
          parsed.staffMembers = parsed.staffMembers.filter(s => s.role !== 'cashier' && s.username !== 'cashier1');
          parsed.staffMembers.forEach(s => {
            if (!s.permissions) s.permissions = {};
            if (s.permissions.medicationTreatment === undefined) s.permissions.medicationTreatment = true;
            if (s.permissions.dailyRecords === undefined) s.permissions.dailyRecords = true;
            if (s.permissions.expenses === undefined) s.permissions.expenses = true;
            if (s.role !== 'developer') {
              s.permissions.settings = false;
              s.permissions.devTools = false;
            }
          });
        }
        if (!parsed.expenses || !Array.isArray(parsed.expenses) || parsed.expenses.length === 0) {
          parsed.expenses = JSON.parse(JSON.stringify(DEFAULT_EXPENSES));
        }
        if (!parsed.treatments || !Array.isArray(parsed.treatments) || parsed.treatments.length === 0) {
          parsed.treatments = JSON.parse(JSON.stringify(DEFAULT_TREATMENTS));
        }
        if (!parsed.dailyDrawerClosings || typeof parsed.dailyDrawerClosings !== 'object') {
          parsed.dailyDrawerClosings = JSON.parse(JSON.stringify(DEFAULT_DAILY_DRAWER_CLOSINGS));
        }
        if (!parsed.dailyOpeningOverrides) {
          parsed.dailyOpeningOverrides = {};
        }
        if (!parsed.loginPageSettings) {
          parsed.loginPageSettings = JSON.parse(JSON.stringify(DEFAULT_LOGIN_PAGE_SETTINGS));
        } else {
          parsed.loginPageSettings.showTestCredentials = false;
          if (!parsed.loginPageSettings.brandName || parsed.loginPageSettings.brandName.includes('Apex')) {
            parsed.loginPageSettings.brandName = 'Bagan Medical Hall';
          }
          if (parsed.loginPageSettings.announcement && parsed.loginPageSettings.announcement.includes('Apex')) {
            parsed.loginPageSettings.announcement = 'Welcome to Bagan Medical Hall. Please verify temperature logs and prescriptions carefully.';
          }
        }
        if (!parsed.staffUiSettings) {
          parsed.staffUiSettings = JSON.parse(JSON.stringify(DEFAULT_STAFF_UI_SETTINGS));
        } else {
          if (!parsed.staffUiSettings.appTitle || parsed.staffUiSettings.appTitle.includes('Apex')) {
            parsed.staffUiSettings.appTitle = 'Bagan Medical Hall';
          }
          if (parsed.staffUiSettings.thermalReceiptFooter && parsed.staffUiSettings.thermalReceiptFooter.includes('Apex')) {
            parsed.staffUiSettings.thermalReceiptFooter = 'Thank you for choosing Bagan Medical Hall!';
          }
        }
        if (parsed.settings) {
          if (!parsed.settings.pharmacyName || parsed.settings.pharmacyName.includes('Apex')) {
            parsed.settings.pharmacyName = 'Bagan Medical Hall';
          }
          if (parsed.settings.email && parsed.settings.email.includes('apex')) {
            parsed.settings.email = 'admin.baganmedicalhall@gmail.com';
          }
        }
        if (!parsed.productCategories || !Array.isArray(parsed.productCategories)) {
          parsed.productCategories = JSON.parse(JSON.stringify(DEFAULT_PRODUCT_CATEGORIES));
        }
        if (!parsed.expenseCategories || !Array.isArray(parsed.expenseCategories)) {
          parsed.expenseCategories = JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
        }
        if (!parsed.dosageForms || !Array.isArray(parsed.dosageForms)) {
          parsed.dosageForms = JSON.parse(JSON.stringify(DEFAULT_DOSAGE_FORMS));
        }
        if (!parsed.treatmentTypes || !Array.isArray(parsed.treatmentTypes)) {
          parsed.treatmentTypes = JSON.parse(JSON.stringify(DEFAULT_TREATMENT_TYPES));
        }
        if (!parsed.administrationRoutes || !Array.isArray(parsed.administrationRoutes)) {
          parsed.administrationRoutes = JSON.parse(JSON.stringify(DEFAULT_ADMIN_ROUTES));
        }
        if (!parsed.statusOptions || !Array.isArray(parsed.statusOptions)) {
          parsed.statusOptions = JSON.parse(JSON.stringify(DEFAULT_STATUS_OPTIONS));
        }
        if (!parsed.taxSettings || typeof parsed.taxSettings !== 'object') {
          parsed.taxSettings = JSON.parse(JSON.stringify(DEFAULT_TAX_SETTINGS));
        }
        if (!parsed.creditCollections || !Array.isArray(parsed.creditCollections)) {
          parsed.creditCollections = JSON.parse(JSON.stringify(DEFAULT_CREDIT_COLLECTIONS));
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse stored pharmacy data, loading defaults', e);
    }
    return this.getDefaultData();
  }

  getDefaultData() {
    return {
      settings: {
        pharmacyName: 'Bagan Medical Hall',
        tagline: 'Your Trusted Pharmacy & Clinical Dispensary',
        licenseNo: 'PH-LIC-2026-449102',
        gstNumber: 'GSTIN-09AAACH7789F1Z4',
        address: '104 Healthcare Avenue, Medical District, Suite 101',
        phone: '+1 (555) 342-8800',
        email: 'admin.baganmedicalhall@gmail.com',
        currency: '$',
        defaultTaxRate: 5,
        printThermal: true, // 80mm
        activeShift: {
          isOpen: true,
          openedAt: '2026-11-18 08:00',
          cashier: 'Chief Pharmacist (Admin)',
          openingFloat: 250.00
        }
      },
      globalSettings: JSON.parse(JSON.stringify(DEFAULT_GLOBAL_SETTINGS)),
      staffMembers: JSON.parse(JSON.stringify(DEFAULT_STAFF)),
      mediaLibrary: JSON.parse(JSON.stringify(DEFAULT_MEDIA_LIBRARY)),
      loginPageSettings: JSON.parse(JSON.stringify(DEFAULT_LOGIN_PAGE_SETTINGS)),
      staffUiSettings: JSON.parse(JSON.stringify(DEFAULT_STAFF_UI_SETTINGS)),
      accounts: JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS)),
      medicines: JSON.parse(JSON.stringify(DEFAULT_MEDICINES)),
      customers: JSON.parse(JSON.stringify(DEFAULT_CUSTOMERS)),
      suppliers: JSON.parse(JSON.stringify(DEFAULT_SUPPLIERS)),
      journalEntries: JSON.parse(JSON.stringify(DEFAULT_JOURNAL_ENTRIES)),
      sales: JSON.parse(JSON.stringify(DEFAULT_SALES)),
      treatments: JSON.parse(JSON.stringify(DEFAULT_TREATMENTS)),
      expenses: JSON.parse(JSON.stringify(DEFAULT_EXPENSES)),
      dailyDrawerClosings: JSON.parse(JSON.stringify(DEFAULT_DAILY_DRAWER_CLOSINGS)),
      dailyOpeningOverrides: {},
      productCategories: JSON.parse(JSON.stringify(DEFAULT_PRODUCT_CATEGORIES)),
      expenseCategories: JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES)),
      dosageForms: JSON.parse(JSON.stringify(DEFAULT_DOSAGE_FORMS)),
      treatmentTypes: JSON.parse(JSON.stringify(DEFAULT_TREATMENT_TYPES)),
      administrationRoutes: JSON.parse(JSON.stringify(DEFAULT_ADMIN_ROUTES)),
      statusOptions: JSON.parse(JSON.stringify(DEFAULT_STATUS_OPTIONS)),
      taxSettings: JSON.parse(JSON.stringify(DEFAULT_TAX_SETTINGS)),
      creditCollections: JSON.parse(JSON.stringify(DEFAULT_CREDIT_COLLECTIONS)),
      parkedSales: []
    };
  }

  updateGlobalSettings(settings) {
    if (!this.data.globalSettings) this.data.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
    this.data.globalSettings = { ...this.data.globalSettings, ...settings };

    // Synchronize universally across app
    if (settings.name) {
      this.data.settings.pharmacyName = settings.name;
      if (this.data.loginPageSettings) this.data.loginPageSettings.brandName = settings.name;
      if (this.data.staffUiSettings) this.data.staffUiSettings.appTitle = settings.name;
    }
    if (settings.tagline) {
      this.data.settings.tagline = settings.tagline;
      if (this.data.loginPageSettings) this.data.loginPageSettings.tagline = settings.tagline;
    }
    if (settings.address) {
      this.data.settings.address = settings.address;
    }
    if (settings.phone) {
      this.data.settings.phone = settings.phone;
    }
    if (settings.email) {
      this.data.settings.email = settings.email;
    }
    if (settings.logo) {
      if (this.data.loginPageSettings) this.data.loginPageSettings.logoText = settings.logo;
    }
    if (settings.logoColored) {
      this.data.globalSettings.logoColored = settings.logoColored;
      this.data.globalSettings.logoImage = settings.logoColored;
      if (this.data.loginPageSettings) this.data.loginPageSettings.logoColored = settings.logoColored;
    }
    if (settings.logoColoredData !== undefined) {
      this.data.globalSettings.logoColoredData = settings.logoColoredData;
      this.data.globalSettings.logoData = settings.logoColoredData;
      if (this.data.loginPageSettings) this.data.loginPageSettings.logoColoredData = settings.logoColoredData;
      try {
        if (settings.logoColoredData) localStorage.setItem('bmh_active_logo_colored', settings.logoColoredData);
        else localStorage.removeItem('bmh_active_logo_colored');
      } catch (_) {}
    }
    if (settings.logoWhite) {
      this.data.globalSettings.logoWhite = settings.logoWhite;
      if (this.data.loginPageSettings) this.data.loginPageSettings.logoWhite = settings.logoWhite;
    }
    if (settings.logoWhiteData !== undefined) {
      this.data.globalSettings.logoWhiteData = settings.logoWhiteData;
      if (this.data.loginPageSettings) this.data.loginPageSettings.logoWhiteData = settings.logoWhiteData;
      try {
        if (settings.logoWhiteData) localStorage.setItem('bmh_active_logo_white', settings.logoWhiteData);
        else localStorage.removeItem('bmh_active_logo_white');
      } catch (_) {}
    }
    if (settings.fallbackLogoImage) {
      this.data.globalSettings.fallbackLogoImage = settings.fallbackLogoImage;
    }
    if (settings.fallbackLogoData !== undefined) {
      this.data.globalSettings.fallbackLogoData = settings.fallbackLogoData;
      try {
        if (settings.fallbackLogoData) localStorage.setItem('bmh_active_logo_fallback', settings.fallbackLogoData);
        else localStorage.removeItem('bmh_active_logo_fallback');
      } catch (_) {}
    }
    if (settings.fallbackType) {
      this.data.globalSettings.fallbackType = settings.fallbackType;
    }
    if (settings.logoImage) {
      if (this.data.loginPageSettings) this.data.loginPageSettings.logoImage = settings.logoImage;
    }
    if (settings.logoType) {
      if (this.data.loginPageSettings) this.data.loginPageSettings.logoType = settings.logoType;
    }
    if (settings.logoData !== undefined) {
      if (this.data.loginPageSettings) this.data.loginPageSettings.logoData = settings.logoData;
    }
    if (settings.primaryColor) {
      if (this.data.loginPageSettings) {
        this.data.loginPageSettings.primaryColor = settings.primaryColor;
        this.data.loginPageSettings.accentColor = settings.primaryColor;
      }
      if (this.data.settings) this.data.settings.primaryColor = settings.primaryColor;
    }
    if (settings.secondaryColor) {
      if (this.data.loginPageSettings) this.data.loginPageSettings.secondaryColor = settings.secondaryColor;
      if (this.data.settings) this.data.settings.secondaryColor = settings.secondaryColor;
    }
    if (settings.greetingMessage !== undefined) {
      if (this.data.loginPageSettings) this.data.loginPageSettings.announcement = settings.greetingMessage;
    }
    this.save();
    return this.data.globalSettings;
  }

  saveStaffMember(staffData) {
    if (!this.data.staffMembers) this.data.staffMembers = [];
    const existingIndex = this.data.staffMembers.findIndex(s => s.id === staffData.id);
    if (existingIndex > -1) {
      this.data.staffMembers[existingIndex] = { ...this.data.staffMembers[existingIndex], ...staffData };
    } else {
      this.data.staffMembers.push(staffData);
    }
    this.save();
    return staffData;
  }

  deleteStaffMember(staffId) {
    if (staffId === 'staff_dev') {
      throw new Error('Cannot delete primary developer super-admin account');
    }
    this.data.staffMembers = this.data.staffMembers.filter(s => s.id !== staffId);
    this.save();
    return true;
  }

  updateLoginPageSettings(settings) {
    this.data.loginPageSettings = { ...this.data.loginPageSettings, ...settings };
    this.save();
    return this.data.loginPageSettings;
  }

  updateStaffUiSettings(settings) {
    this.data.staffUiSettings = { ...this.data.staffUiSettings, ...settings };
    this.save();
    return this.data.staffUiSettings;
  }

  addMediaItem(item) {
    if (!this.data.mediaLibrary) this.data.mediaLibrary = JSON.parse(JSON.stringify(DEFAULT_MEDIA_LIBRARY));
    const idx = this.data.mediaLibrary.findIndex(m => m.filename === item.filename);
    if (idx > -1) {
      this.data.mediaLibrary[idx] = { ...this.data.mediaLibrary[idx], ...item };
    } else {
      this.data.mediaLibrary.unshift(item);
    }
    if (item.dataUrl) {
      BaganMediaStore.saveMedia(item);
    }
    this.save();
    return item;
  }

  deleteMediaItem(idOrFilename) {
    if (!this.data.mediaLibrary) return;
    const target = this.data.mediaLibrary.find(m => m.id === idOrFilename || m.filename === idOrFilename);
    const fn = target ? target.filename : idOrFilename;
    this.data.mediaLibrary = this.data.mediaLibrary.filter(m => m.id !== idOrFilename && m.filename !== idOrFilename);
    BaganMediaStore.deleteMedia(fn);
    this.save();
  }

  // -------------------------------------------------------------
  // PHARMACY EXPENSE MANAGEMENT
  // -------------------------------------------------------------
  addExpense(expense) {
    if (!this.data.expenses) this.data.expenses = [];
    const newExp = {
      id: expense.id || ('EXP-' + Date.now()),
      voucherNo: expense.voucherNo || ('VCH-' + Math.floor(1000 + Math.random() * 9000)),
      date: expense.date || new Date().toISOString().split('T')[0],
      category: expense.category || 'General Operating',
      amount: parseFloat(expense.amount) || 0,
      paymentMethod: expense.paymentMethod || 'Cash from Drawer',
      paidTo: expense.paidTo || 'Vendor / Payee',
      description: expense.description || '',
      recordedBy: expense.recordedBy || 'Staff Pharmacist',
      createdAt: expense.createdAt || new Date().toISOString()
    };
    this.data.expenses.unshift(newExp);

    // Double-entry ledger synchronization
    const creditAccount = newExp.paymentMethod.includes('Cash') ? '1010' : '1020';
    let debitAccount = '5090'; // General Dispensary Operating Expenses
    const catLower = newExp.category.toLowerCase();
    if (catLower.includes('util') || catLower.includes('power') || catLower.includes('elect')) debitAccount = '5040';
    else if (catLower.includes('wage') || catLower.includes('sal') || catLower.includes('staff')) debitAccount = '5030';
    else if (catLower.includes('rent')) debitAccount = '5020';
    else if (catLower.includes('pack') || catLower.includes('bag') || catLower.includes('label')) debitAccount = '5070';
    else if (catLower.includes('licens') || catLower.includes('fee')) debitAccount = '5060';

    try {
      this.postJournalEntry({
        date: newExp.date,
        type: 'EXPENSE',
        reference: newExp.voucherNo,
        description: `Operating Expense: ${newExp.category} - ${newExp.description}`,
        debits: [{ accountId: debitAccount, amount: newExp.amount }],
        credits: [{ accountId: creditAccount, amount: newExp.amount }]
      });
    } catch (_) {}

    this.save();
    return newExp;
  }

  updateExpense(updated) {
    if (!this.data.expenses) return null;
    const idx = this.data.expenses.findIndex(e => e.id === updated.id);
    if (idx > -1) {
      this.data.expenses[idx] = { ...this.data.expenses[idx], ...updated };
      this.recalculateAllAccountBalances();
      this.save();
      return this.data.expenses[idx];
    }
    return null;
  }

  deleteExpense(id) {
    if (!this.data.expenses) return false;
    this.data.expenses = this.data.expenses.filter(e => e.id !== id);
    this.recalculateAllAccountBalances();
    this.save();
    return true;
  }

  // -------------------------------------------------------------
  // CLINICAL MEDICATION & TREATMENT MANAGEMENT
  // -------------------------------------------------------------
  addTreatment(t) {
    if (!this.data.treatments) this.data.treatments = [];
    const newTrt = {
      id: t.id || ('TRT-' + Date.now()),
      treatmentNo: t.treatmentNo || ('TRT-' + Math.floor(1000 + Math.random() * 9000)),
      date: t.date || new Date().toISOString().split('T')[0],
      time: t.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      patientId: t.patientId || '',
      patientName: t.patientName || 'Walk-in Patient',
      patientPhone: t.patientPhone || '',
      doctorName: t.doctorName || 'Attending Physician',
      treatmentType: t.treatmentType || 'General Medication & Treatment',
      medicationUsed: t.medicationUsed || '',
      dosageRoute: t.dosageRoute || '',
      vitals: t.vitals || '',
      chargeAmount: parseFloat(t.chargeAmount) || 0,
      status: t.status || 'Administered',
      clinicalNotes: t.clinicalNotes || '',
      administeredBy: t.administeredBy || 'Staff Pharmacist',
      createdAt: t.createdAt || new Date().toISOString()
    };
    this.data.treatments.unshift(newTrt);
    this.save();
    return newTrt;
  }

  updateTreatment(t) {
    if (!this.data.treatments) return null;
    const idx = this.data.treatments.findIndex(item => item.id === t.id);
    if (idx > -1) {
      this.data.treatments[idx] = { ...this.data.treatments[idx], ...t };
      this.save();
      return this.data.treatments[idx];
    }
    return null;
  }

  deleteTreatment(id) {
    if (!this.data.treatments) return false;
    this.data.treatments = this.data.treatments.filter(t => t.id !== id);
    this.save();
    return true;
  }

  // -------------------------------------------------------------
  // DAILY CASH DRAWER & FINANCIAL AUDIT RECORDS
  // -------------------------------------------------------------
  getDailyDrawerRecord(targetDateStr) {
    if (!targetDateStr) {
      targetDateStr = new Date().toISOString().split('T')[0];
    }

    // Determine Previous Day YYYY-MM-DD
    const curParts = targetDateStr.split('-');
    const curD = new Date(parseInt(curParts[0]), parseInt(curParts[1]) - 1, parseInt(curParts[2]));
    const prevD = new Date(curD);
    prevD.setDate(prevD.getDate() - 1);
    const prevDateStr = prevD.toISOString().split('T')[0];

    // 1. OPENING DRAWER BALANCE:
    // "final collection should be opening balance of next day"
    let openingBalance = 1200.00;
    let openingSource = 'default';

    if (this.data.dailyOpeningOverrides && this.data.dailyOpeningOverrides[targetDateStr] !== undefined) {
      openingBalance = parseFloat(this.data.dailyOpeningOverrides[targetDateStr]) || 0;
      openingSource = 'manual_override';
    } else if (this.data.dailyDrawerClosings && this.data.dailyDrawerClosings[prevDateStr]) {
      const prevClosing = this.data.dailyDrawerClosings[prevDateStr];
      openingBalance = parseFloat(prevClosing.finalClosingBalance !== undefined ? prevClosing.finalClosingBalance : prevClosing.closingDrawerBalance) || 0;
      openingSource = 'chained_from_previous_day';
    }

    // 2. DAILY SALES FOR THIS DATE
    const daySales = (this.data.sales || []).filter(s => s.date && s.date.startsWith(targetDateStr));
    let cashSales = 0;
    let onlineCollection = 0;
    let cardCollection = 0;
    let creditSales = 0;

    daySales.forEach(s => {
      const pm = (s.paymentMethod || '').toLowerCase();
      const grand = parseFloat(s.grandTotal) || 0;
      if (pm.includes('cash')) {
        cashSales += grand;
      } else if (pm.includes('online') || pm.includes('upi') || pm.includes('qr')) {
        onlineCollection += grand;
      } else if (pm.includes('card')) {
        cardCollection += grand;
      } else {
        creditSales += grand;
      }
    });

    const totalDigitalCollection = onlineCollection + cardCollection;
    const totalDaySales = cashSales + totalDigitalCollection + creditSales;

    // 3. DAILY EXPENSES FOR THIS DATE
    const dayExpenses = (this.data.expenses || []).filter(e => e.date === targetDateStr);
    let cashExpenses = 0;
    let digitalExpenses = 0;

    dayExpenses.forEach(e => {
      const amt = parseFloat(e.amount) || 0;
      if ((e.paymentMethod || '').includes('Cash') || e.isCashFromDrawer) {
        cashExpenses += amt;
      } else {
        digitalExpenses += amt;
      }
    });
    const totalDayExpenses = cashExpenses + digitalExpenses;

    // 4. DAILY TREATMENTS FOR THIS DATE
    const dayTreatments = (this.data.treatments || []).filter(t => t.date === targetDateStr);
    let treatmentRevenue = 0;
    let treatmentCash = 0;
    let treatmentDigital = 0;
    dayTreatments.forEach(t => {
      const amt = parseFloat(t.chargeAmount) || 0;
      treatmentRevenue += amt;
      const pm = (t.paymentMethod || '').toLowerCase();
      if (pm.includes('cash')) {
        treatmentCash += amt;
      } else {
        treatmentDigital += amt;
      }
    });

    // 4b. DAILY PATIENT CREDIT SETTLEMENTS / COLLECTIONS FOR THIS DATE
    const dayCreditCollections = (this.data.creditCollections || []).filter(c => c.date === targetDateStr);
    let creditCash = 0;
    let creditDigital = 0;
    dayCreditCollections.forEach(c => {
      const amt = parseFloat(c.amount) || 0;
      const isCash = (c.paymentMode || '').toLowerCase().includes('cash') || !!c.isCashDrawer;
      if (isCash) {
        creditCash += amt;
      } else {
        creditDigital += amt;
      }
    });
    const totalCreditCollected = creditCash + creditDigital;

    // 5. NET COLLECTIONS & FINAL DRAWER BALANCE (Sales Cash + Treatment Cash + Credit Cash - Cash Expenses)
    const netCashCollection = (cashSales + treatmentCash + creditCash) - cashExpenses;
    const finalClosingBalance = Math.round((openingBalance + netCashCollection) * 100) / 100;
    const combinedDigitalCollection = totalDigitalCollection + treatmentDigital + creditDigital;
    const totalCollection = totalDaySales + treatmentRevenue + totalCreditCollected;

    // Check shift status
    const closingRecord = this.data.dailyDrawerClosings ? this.data.dailyDrawerClosings[targetDateStr] : null;
    const isClosed = !!(closingRecord && (closingRecord.status === 'Closed' || closingRecord.isClosed));

    // Build consolidated transactions list for the date
    const transactions = [];

    // Sales transactions
    daySales.forEach(s => {
      const isCash = (s.paymentMethod || '').toLowerCase().includes('cash');
      const amt = parseFloat(s.grandTotal) || 0;
      transactions.push({
        id: s.id,
        ref: s.invoiceNo,
        time: s.date.includes(' ') ? s.date.split(' ')[1] : '12:00',
        type: 'POS Sale',
        typeLabel: 'Dispensary Sale',
        category: 'POS Cashier',
        counterparty: s.customerName || 'Walk-in Customer',
        description: `Customer Invoice #${s.invoiceNo} (${(s.items || []).map(i => i.name).join(', ')})`,
        paymentMethod: s.paymentMethod || 'Cash',
        amount: amt,
        inflow: amt,
        outflow: 0,
        isCashDrawer: isCash,
        status: 'Completed',
        notes: (s.items || []).map(i => i.name).join(', ')
      });
    });

    // Credit collections transactions (A/c Receivable Cash / QR Receipts)
    dayCreditCollections.forEach(c => {
      const isCash = (c.paymentMode || '').toLowerCase().includes('cash') || !!c.isCashDrawer;
      const amt = parseFloat(c.amount) || 0;
      transactions.push({
        id: c.id,
        ref: c.receiptNo || c.id,
        time: c.time || '11:00',
        type: 'Credit Collection',
        typeLabel: 'Patient Credit Settlement',
        category: 'Customer A/c Clearance',
        counterparty: c.customerName || 'Patient',
        description: `Credit payment from ${c.customerName || 'Patient'} (${c.narration || 'Credit clearance'})`,
        paymentMethod: c.paymentMode || (isCash ? 'Cash' : 'Bank'),
        amount: amt,
        inflow: amt,
        outflow: 0,
        isCashDrawer: isCash,
        status: c.status || 'Collected',
        notes: `Receipt #${c.receiptNo || c.id}`
      });
    });

    // Expense transactions
    dayExpenses.forEach(e => {
      const isCash = (e.paymentMethod || '').includes('Cash') || !!e.isCashFromDrawer;
      const amt = parseFloat(e.amount) || 0;
      transactions.push({
        id: e.id,
        ref: e.voucherNo,
        time: e.time || (e.createdAt ? new Date(e.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '12:00'),
        type: 'Expense',
        typeLabel: 'Dispensary Expense',
        category: e.category,
        counterparty: e.payee || e.paidTo || 'Vendor',
        description: `${e.category}: ${e.description} (Payee: ${e.payee || e.paidTo || 'Vendor'})`,
        paymentMethod: e.paymentMethod,
        amount: amt,
        inflow: 0,
        outflow: amt,
        isCashDrawer: isCash,
        status: 'Verified',
        notes: e.description
      });
    });

    // Treatment transactions
    dayTreatments.forEach(t => {
      const isCash = (t.paymentMethod || '').toLowerCase().includes('cash');
      const amt = parseFloat(t.chargeAmount) || 0;
      transactions.push({
        id: t.id,
        ref: t.treatmentNo || t.id,
        time: t.time || '12:00',
        type: 'Clinical Treatment',
        typeLabel: 'Clinical Treatment',
        category: t.treatmentType,
        counterparty: t.patientName,
        description: `${t.treatmentType}: ${t.medicationUsed || 'Procedure'} (${t.patientName})`,
        paymentMethod: t.paymentMethod || 'Cash',
        amount: amt,
        inflow: amt,
        outflow: 0,
        isCashDrawer: isCash,
        status: t.status || 'Administered',
        notes: `${t.medicationUsed} - ${t.dosage || ''}`
      });
    });

    // Sort transactions by time
    transactions.sort((a, b) => ((a.time || '') > (b.time || '') ? 1 : -1));

    return {
      date: targetDateStr,
      prevDate: prevDateStr,
      openingPrevDate: prevDateStr,
      openingBalance,
      openingSource,
      cashSales,
      onlineCollection,
      cardCollection,
      onlineQrSales: combinedDigitalCollection,
      totalDigitalCollection: combinedDigitalCollection,
      creditSales,
      grossSales: totalDaySales,
      totalDaySales,
      treatmentRevenue,
      treatmentCash,
      treatmentDigital,
      creditCash,
      creditDigital,
      creditCollectedCash: creditCash,
      creditCollectedDigital: creditDigital,
      totalCreditCollected,
      creditCollected: totalCreditCollected,
      cashExpenses,
      digitalExpenses,
      totalDayExpenses,
      netDrawerCash: netCashCollection,
      netCashCollection,
      totalCollection,
      finalClosingBalance,
      closingDrawerBalance: finalClosingBalance,
      isClosed,
      closingRecord,
      transactions
    };
  }

  closeDailyDrawerShift(dateStr, physicalCount = null, notes = '', closedBy = 'Staff Pharmacist') {
    if (!this.data.dailyDrawerClosings) this.data.dailyDrawerClosings = {};
    const rec = this.getDailyDrawerRecord(dateStr);
    const finalBalance = (physicalCount !== null && physicalCount !== undefined && physicalCount !== '') 
      ? parseFloat(physicalCount) 
      : rec.finalClosingBalance;

    const shiftData = {
      date: dateStr,
      openingBalance: rec.openingBalance,
      cashSales: rec.cashSales,
      cashExpenses: rec.cashExpenses,
      netCashCollection: rec.netCashCollection,
      onlineCollection: rec.totalDigitalCollection,
      finalClosingBalance: finalBalance,
      closingDrawerBalance: finalBalance,
      isClosed: true,
      systemExpected: rec.finalClosingBalance,
      physicalCount: physicalCount,
      difference: (physicalCount !== null && physicalCount !== '') ? (parseFloat(physicalCount) - rec.finalClosingBalance) : 0,
      status: 'Closed',
      closedBy: closedBy,
      closedAt: new Date().toISOString(),
      notes: notes || 'Daily shift completed and verified.'
    };

    this.data.dailyDrawerClosings[dateStr] = shiftData;
    this.save();
    return shiftData;
  }

  overrideDailyOpeningBalance(dateStr, amount) {
    if (!this.data.dailyOpeningOverrides) this.data.dailyOpeningOverrides = {};
    this.data.dailyOpeningOverrides[dateStr] = parseFloat(amount) || 0;
    this.save();
    return this.data.dailyOpeningOverrides[dateStr];
  }

  /* =============================================================
   * MASTER CATALOGS & TAXATION MANAGEMENT (DEVELOPER CONTROL)
   * ============================================================= */

  // 1. PRODUCT CATEGORIES CRUD
  getProductCategories() {
    return this.data.productCategories || [];
  }
  addProductCategory(cat) {
    if (!this.data.productCategories) this.data.productCategories = [];
    const newCat = {
      id: 'CAT-' + (Date.now().toString().slice(-4)),
      name: (cat.name || '').trim(),
      description: (cat.description || '').trim(),
      color: cat.color || '#0284c7',
      isDefault: false
    };
    this.data.productCategories.push(newCat);
    this.save();
    return newCat;
  }
  updateProductCategory(cat) {
    if (!this.data.productCategories) return null;
    const idx = this.data.productCategories.findIndex(c => c.id === cat.id);
    if (idx !== -1) {
      this.data.productCategories[idx] = { ...this.data.productCategories[idx], ...cat };
      this.save();
      return this.data.productCategories[idx];
    }
    return null;
  }
  deleteProductCategory(id) {
    if (!this.data.productCategories) return false;
    this.data.productCategories = this.data.productCategories.filter(c => c.id !== id);
    this.save();
    return true;
  }

  // 2. PRODUCT EXPENSE CATEGORIES CRUD
  getExpenseCategories() {
    return this.data.expenseCategories || [];
  }
  addExpenseCategory(cat) {
    if (!this.data.expenseCategories) this.data.expenseCategories = [];
    const newCat = {
      id: 'EXPCAT-' + (Date.now().toString().slice(-4)),
      name: (cat.name || '').trim(),
      description: (cat.description || '').trim(),
      defaultAccount: cat.defaultAccount || '5090',
      isDefault: false
    };
    this.data.expenseCategories.push(newCat);
    this.save();
    return newCat;
  }
  updateExpenseCategory(cat) {
    if (!this.data.expenseCategories) return null;
    const idx = this.data.expenseCategories.findIndex(c => c.id === cat.id);
    if (idx !== -1) {
      this.data.expenseCategories[idx] = { ...this.data.expenseCategories[idx], ...cat };
      this.save();
      return this.data.expenseCategories[idx];
    }
    return null;
  }
  deleteExpenseCategory(id) {
    if (!this.data.expenseCategories) return false;
    this.data.expenseCategories = this.data.expenseCategories.filter(c => c.id !== id);
    this.save();
    return true;
  }

  // 3. DOSAGE FORMS CRUD
  getDosageForms() {
    return this.data.dosageForms || [];
  }
  addDosageForm(form) {
    if (!this.data.dosageForms) this.data.dosageForms = [];
    const newForm = {
      id: 'DF-' + (Date.now().toString().slice(-4)),
      name: (form.name || '').trim(),
      code: (form.code || '').trim().toUpperCase(),
      description: (form.description || '').trim(),
      isDefault: false
    };
    this.data.dosageForms.push(newForm);
    this.save();
    return newForm;
  }
  updateDosageForm(form) {
    if (!this.data.dosageForms) return null;
    const idx = this.data.dosageForms.findIndex(f => f.id === form.id);
    if (idx !== -1) {
      this.data.dosageForms[idx] = { ...this.data.dosageForms[idx], ...form };
      this.save();
      return this.data.dosageForms[idx];
    }
    return null;
  }
  deleteDosageForm(id) {
    if (!this.data.dosageForms) return false;
    this.data.dosageForms = this.data.dosageForms.filter(f => f.id !== id);
    this.save();
    return true;
  }

  // 4. PROCEDURE / TREATMENT TYPES CRUD *
  getTreatmentTypes() {
    return this.data.treatmentTypes || [];
  }
  addTreatmentType(type) {
    if (!this.data.treatmentTypes) this.data.treatmentTypes = [];
    const newType = {
      id: 'TT-' + (Date.now().toString().slice(-4)),
      name: (type.name || '').trim(),
      defaultCharge: parseFloat(type.defaultCharge) || 0,
      description: (type.description || '').trim(),
      isDefault: false
    };
    this.data.treatmentTypes.push(newType);
    this.save();
    return newType;
  }
  updateTreatmentType(type) {
    if (!this.data.treatmentTypes) return null;
    const idx = this.data.treatmentTypes.findIndex(t => t.id === type.id);
    if (idx !== -1) {
      this.data.treatmentTypes[idx] = { ...this.data.treatmentTypes[idx], ...type };
      this.save();
      return this.data.treatmentTypes[idx];
    }
    return null;
  }
  deleteTreatmentType(id) {
    if (!this.data.treatmentTypes) return false;
    this.data.treatmentTypes = this.data.treatmentTypes.filter(t => t.id !== id);
    this.save();
    return true;
  }

  // 5. ADMINISTRATION ROUTES CRUD
  getAdministrationRoutes() {
    return this.data.administrationRoutes || [];
  }
  addAdministrationRoute(route) {
    if (!this.data.administrationRoutes) this.data.administrationRoutes = [];
    const newRoute = {
      id: 'AR-' + (Date.now().toString().slice(-4)),
      name: (route.name || '').trim(),
      code: (route.code || '').trim().toUpperCase(),
      description: (route.description || '').trim(),
      isDefault: false
    };
    this.data.administrationRoutes.push(newRoute);
    this.save();
    return newRoute;
  }
  updateAdministrationRoute(route) {
    if (!this.data.administrationRoutes) return null;
    const idx = this.data.administrationRoutes.findIndex(r => r.id === route.id);
    if (idx !== -1) {
      this.data.administrationRoutes[idx] = { ...this.data.administrationRoutes[idx], ...route };
      this.save();
      return this.data.administrationRoutes[idx];
    }
    return null;
  }
  deleteAdministrationRoute(id) {
    if (!this.data.administrationRoutes) return false;
    this.data.administrationRoutes = this.data.administrationRoutes.filter(r => r.id !== id);
    this.save();
    return true;
  }

  // 6. STATUS OPTIONS CRUD *
  getStatuses(scope = null) {
    let list = this.data.statusOptions || [];
    if (scope) {
      list = list.filter(s => s.scope === scope || s.scope === 'all');
    }
    return list;
  }
  addStatus(status) {
    if (!this.data.statusOptions) this.data.statusOptions = [];
    const newStatus = {
      id: 'ST-' + (Date.now().toString().slice(-4)),
      name: (status.name || '').trim(),
      scope: status.scope || 'treatment',
      label: (status.label || status.name).trim(),
      badgeColor: status.badgeColor || '#6366f1',
      textColor: status.textColor || '#ffffff',
      isDefault: false
    };
    this.data.statusOptions.push(newStatus);
    this.save();
    return newStatus;
  }
  updateStatus(status) {
    if (!this.data.statusOptions) return null;
    const idx = this.data.statusOptions.findIndex(s => s.id === status.id);
    if (idx !== -1) {
      this.data.statusOptions[idx] = { ...this.data.statusOptions[idx], ...status };
      this.save();
      return this.data.statusOptions[idx];
    }
    return null;
  }
  deleteStatus(id) {
    if (!this.data.statusOptions) return false;
    this.data.statusOptions = this.data.statusOptions.filter(s => s.id !== id);
    this.save();
    return true;
  }

  // 7. TAX SYSTEM CONFIGURATION & SLABS SETUP
  getTaxSettings() {
    return this.data.taxSettings || DEFAULT_TAX_SETTINGS;
  }
  updateTaxSettings(settings) {
    if (!this.data.taxSettings) this.data.taxSettings = { ...DEFAULT_TAX_SETTINGS };
    this.data.taxSettings = { ...this.data.taxSettings, ...settings };
    if (settings.defaultRate !== undefined) {
      this.data.settings.defaultTaxRate = parseFloat(settings.defaultRate) || 0;
    }
    if (settings.taxName) {
      this.data.settings.taxName = settings.taxName;
    }
    if (settings.regNumber) {
      this.data.settings.gstNumber = settings.regNumber;
    }
    this.save();
    return this.data.taxSettings;
  }
  addTaxSlab(slab) {
    if (!this.data.taxSettings) this.data.taxSettings = { ...DEFAULT_TAX_SETTINGS };
    if (!this.data.taxSettings.slabs) this.data.taxSettings.slabs = [];
    const newSlab = {
      id: 'TAX-' + (Date.now().toString().slice(-4)),
      name: (slab.name || '').trim(),
      rate: parseFloat(slab.rate) || 0,
      description: (slab.description || '').trim(),
      isDefault: !!slab.isDefault
    };
    if (newSlab.isDefault) {
      this.data.taxSettings.slabs.forEach(s => s.isDefault = false);
      this.data.taxSettings.defaultRate = newSlab.rate;
    }
    this.data.taxSettings.slabs.push(newSlab);
    this.save();
    return newSlab;
  }
  updateTaxSlab(slab) {
    if (!this.data.taxSettings || !this.data.taxSettings.slabs) return null;
    const idx = this.data.taxSettings.slabs.findIndex(s => s.id === slab.id);
    if (idx !== -1) {
      if (slab.isDefault) {
        this.data.taxSettings.slabs.forEach(s => s.isDefault = false);
        this.data.taxSettings.defaultRate = parseFloat(slab.rate) || 0;
      }
      this.data.taxSettings.slabs[idx] = { ...this.data.taxSettings.slabs[idx], ...slab };
      this.save();
      return this.data.taxSettings.slabs[idx];
    }
    return null;
  }
  deleteTaxSlab(id) {
    if (!this.data.taxSettings || !this.data.taxSettings.slabs) return false;
    this.data.taxSettings.slabs = this.data.taxSettings.slabs.filter(s => s.id !== id);
    this.save();
    return true;
  }

  // 8. PATIENT CREDIT COLLECTIONS (RECEIVABLE RECEIPTS)
  getCreditCollections(date = null) {
    let list = this.data.creditCollections || [];
    if (date) {
      list = list.filter(c => c.date === date);
    }
    return list;
  }

  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Error saving pharmacy data to LocalStorage:', e);
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        try {
          const slimData = JSON.parse(JSON.stringify(this.data));
          if (slimData.globalSettings) {
            delete slimData.globalSettings.logoColoredData;
            delete slimData.globalSettings.logoWhiteData;
            delete slimData.globalSettings.fallbackLogoData;
            delete slimData.globalSettings.logoData;
          }
          if (Array.isArray(slimData.mediaLibrary)) {
            slimData.mediaLibrary.forEach(m => delete m.dataUrl);
          }
          localStorage.setItem(DB_KEY, JSON.stringify(slimData));
          console.warn('Saved slimmed data to LocalStorage after quota alert.');
        } catch (innerErr) {
          console.error('Failed to save even after slimming:', innerErr);
        }
      }
    }
  }

  resetToDemo() {
    this.data = this.getDefaultData();
    this.recalculateAllAccountBalances();
    this.save();
    return true;
  }

  exportDataJson() {
    return JSON.stringify(this.data, null, 2);
  }

  importDataJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.accounts || !parsed.medicines || !parsed.journalEntries) {
        throw new Error('Invalid database schema structure');
      }
      this.data = parsed;
      this.recalculateAllAccountBalances();
      this.save();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /* -------------------------------------------------------------
   * DOUBLE ENTRY ACCOUNTING CORE ENGINE
   * ------------------------------------------------------------- */

  /**
   * Recalculates every account balance by summing debits and credits from all journal entries.
   * Ensures 100% mathematical integrity across all reports.
   */
  recalculateAllAccountBalances() {
    // Reset account balances to 0
    const balances = {};
    this.data.accounts.forEach(acc => {
      balances[acc.id] = 0;
    });

    // Sum from all journal entries
    this.data.journalEntries.forEach(journal => {
      journal.entries.forEach(entry => {
        const acc = this.data.accounts.find(a => a.id === entry.accountId);
        if (acc) {
          const debit = parseFloat(entry.debit) || 0;
          const credit = parseFloat(entry.credit) || 0;
          if (acc.normal === 'Debit') {
            balances[acc.id] += (debit - credit);
          } else {
            balances[acc.id] += (credit - debit);
          }
        }
      });
    });

    // Update account balances
    this.data.accounts.forEach(acc => {
      acc.balance = Math.round((balances[acc.id] || 0) * 100) / 100;
    });

    // Also update Customer receivable balances
    const customerDebts = {};
    this.data.customers.forEach(c => customerDebts[c.id] = 0);
    this.data.journalEntries.forEach(journal => {
      if (journal.customerId) {
        journal.entries.forEach(entry => {
          if (entry.accountId === '1030') { // AR
            const deb = parseFloat(entry.debit) || 0;
            const cred = parseFloat(entry.credit) || 0;
            customerDebts[journal.customerId] = (customerDebts[journal.customerId] || 0) + (deb - cred);
          }
        });
      }
    });
    this.data.customers.forEach(c => {
      if (customerDebts[c.id] !== undefined) {
        c.balance = Math.max(0, Math.round(customerDebts[c.id] * 100) / 100);
      }
    });

    // Also update Supplier payable balances
    const supplierDebts = {};
    this.data.suppliers.forEach(s => supplierDebts[s.id] = 0);
    this.data.journalEntries.forEach(journal => {
      if (journal.supplierId) {
        journal.entries.forEach(entry => {
          if (entry.accountId === '2010') { // AP
            const deb = parseFloat(entry.debit) || 0;
            const cred = parseFloat(entry.credit) || 0;
            supplierDebts[journal.supplierId] = (supplierDebts[journal.supplierId] || 0) + (cred - deb);
          }
        });
      }
    });
    this.data.suppliers.forEach(s => {
      if (supplierDebts[s.id] !== undefined) {
        s.balancePayable = Math.max(0, Math.round(supplierDebts[s.id] * 100) / 100);
      }
    });
  }

  /**
   * Adds a balanced double-entry journal entry.
   * Throws an error if Total Debits != Total Credits.
   */
  addJournalEntry(entryData) {
    const { date, voucherType, reference, narration, entries, customerId, supplierId } = entryData;
    
    let totalDebit = 0;
    let totalCredit = 0;

    const validatedEntries = entries.map(item => {
      const debit = Math.round((parseFloat(item.debit) || 0) * 100) / 100;
      const credit = Math.round((parseFloat(item.credit) || 0) * 100) / 100;
      totalDebit += debit;
      totalCredit += credit;

      const acc = this.data.accounts.find(a => a.id === item.accountId);
      return {
        accountId: item.accountId,
        accountName: acc ? acc.name : (item.accountName || 'Unknown Account'),
        debit,
        credit
      };
    });

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Double-entry balance check failed! Total Debits ($${totalDebit.toFixed(2)}) must equal Total Credits ($${totalCredit.toFixed(2)}). Difference: $${Math.abs(totalDebit - totalCredit).toFixed(2)}`);
    }

    const newId = 'JRN-' + (1000 + this.data.journalEntries.length + 1);
    const newJournal = {
      id: newId,
      date: date || new Date().toISOString().split('T')[0],
      voucherType: voucherType || 'Journal Voucher',
      reference: reference || ('REF-' + Date.now().toString().slice(-6)),
      narration: narration || '',
      customerId: customerId || null,
      supplierId: supplierId || null,
      entries: validatedEntries
    };

    this.data.journalEntries.push(newJournal);
    this.recalculateAllAccountBalances();
    this.save();
    return newJournal;
  }

  /**
   * Process a Completed POS Sale with automatic inventory deduction and double-entry accounting.
   */
  processPOSSale(saleData) {
    const {
      customerId,
      customerName,
      doctorName,
      rxNumber,
      items,
      subtotal,
      discountAmount,
      taxAmount,
      grandTotal,
      paymentMethod,
      amountPaid,
      changeGiven,
      notes
    } = saleData;

    // 1. Deduct Inventory & calculate COGS
    let totalCogs = 0;
    items.forEach(cartItem => {
      const med = this.data.medicines.find(m => m.id === cartItem.medicineId);
      if (med) {
        if (med.stock < cartItem.quantity) {
          console.warn(`Selling item ${med.brandName} with stock ${med.stock} below cart quantity ${cartItem.quantity}`);
        }
        med.stock -= cartItem.quantity;
        totalCogs += (med.costPrice * cartItem.quantity);
      }
    });

    totalCogs = Math.round(totalCogs * 100) / 100;

    // 2. Generate Invoice Record
    const nextInvNum = this.data.sales.length + 1001;
    const invId = 'INV-' + Date.now().toString().slice(-6);
    const invoiceNo = (paymentMethod === 'Credit / Ledger' ? 'CR-' : 'POS-') + nextInvNum;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const saleRecord = {
      id: invId,
      invoiceNo,
      date: nowStr,
      customerId: customerId || 'CUST-000',
      customerName: customerName || 'Walk-In Customer',
      doctorName: doctorName || '',
      rxNumber: rxNumber || '',
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      paymentMethod,
      amountPaid: Math.round(amountPaid * 100) / 100,
      changeGiven: Math.round(changeGiven * 100) / 100,
      notes: notes || ''
    };

    this.data.sales.push(saleRecord);

    // 3. Create Corresponding Double-Entry Accounting Journal Entry
    // Debit side: Payment received or Accounts Receivable
    // Credit side: Sales Revenue (gross), Tax Payable, less Discounts
    // Also COGS: Debit COGS, Credit Inventory
    const journalEntriesList = [];

    // Receivable / Cash / Bank Debit
    if (paymentMethod === 'Cash') {
      journalEntriesList.push({ accountId: '1010', accountName: 'Cash in Hand (POS Drawer)', debit: grandTotal, credit: 0 });
    } else if (paymentMethod === 'Card' || paymentMethod === 'UPI / Digital QR') {
      journalEntriesList.push({ accountId: '1020', accountName: 'Main Bank Account (Operating)', debit: grandTotal, credit: 0 });
    } else if (paymentMethod === 'Credit / Ledger') {
      journalEntriesList.push({ accountId: '1030', accountName: 'Accounts Receivable (Patient Credit)', debit: grandTotal, credit: 0 });
    } else { // Insurance / TPA
      journalEntriesList.push({ accountId: '1030', accountName: 'Accounts Receivable (Patient Credit)', debit: grandTotal, credit: 0 });
    }

    // Discount if any (Contra Revenue Debit)
    if (discountAmount > 0) {
      journalEntriesList.push({ accountId: '4030', accountName: 'Sales Discounts Allowed', debit: discountAmount, credit: 0 });
    }

    // Sales Revenue Credit (exclusive of tax)
    const netRevenue = Math.round((subtotal) * 100) / 100;
    journalEntriesList.push({ accountId: '4010', accountName: 'Medicine Sales (Rx & OTC)', debit: 0, credit: netRevenue });

    // Tax Payable Credit
    if (taxAmount > 0) {
      journalEntriesList.push({ accountId: '2020', accountName: 'Sales Tax / GST Payable', debit: 0, credit: taxAmount });
    }

    // COGS Entry (Debit COGS, Credit Inventory Asset)
    if (totalCogs > 0) {
      journalEntriesList.push({ accountId: '5010', accountName: 'Cost of Goods Sold (COGS)', debit: totalCogs, credit: 0 });
      journalEntriesList.push({ accountId: '1040', accountName: 'Pharmacy Inventory / Stock Asset', debit: 0, credit: totalCogs });
    }

    this.addJournalEntry({
      date: nowStr.split(' ')[0],
      voucherType: 'POS Sales Voucher',
      reference: invoiceNo,
      narration: `Pharmacy POS sale to ${saleRecord.customerName}. Tender: ${paymentMethod}`,
      customerId: (paymentMethod === 'Credit / Ledger' || customerId !== 'CUST-000') ? customerId : null,
      entries: journalEntriesList
    });

    this.save();
    return saleRecord;
  }

  /**
   * Record a Purchase Bill / Good Received Note from a Supplier.
   * Adds stock, updates cost/selling prices, and posts Accounting Voucher.
   */
  processSupplierPurchase(purchaseData) {
    const {
      supplierId,
      invoiceNumber,
      date,
      paymentMethod, // 'Credit' or 'Bank' or 'Cash'
      items, // [ { medicineId, brandName, batchNo, expiryDate, quantity, costPrice, sellingPrice, mrp, taxRate } ]
      notes
    } = purchaseData;

    const supplier = this.data.suppliers.find(s => s.id === supplierId);
    if (!supplier) throw new Error('Selected supplier does not exist');

    let totalSubtotal = 0;
    let totalTax = 0;

    items.forEach(item => {
      const lineCost = item.quantity * item.costPrice;
      const lineTax = (lineCost * (item.taxRate || 5)) / 100;
      totalSubtotal += lineCost;
      totalTax += lineTax;

      // Update medicine inventory
      let med = this.data.medicines.find(m => m.id === item.medicineId);
      if (med) {
        med.stock += parseInt(item.quantity, 10);
        med.batchNo = item.batchNo || med.batchNo;
        med.expiryDate = item.expiryDate || med.expiryDate;
        med.costPrice = parseFloat(item.costPrice);
        if (item.sellingPrice) med.sellingPrice = parseFloat(item.sellingPrice);
        if (item.mrp) med.mrp = parseFloat(item.mrp);
      } else {
        // Add new medicine
        const newMed = {
          id: 'MED-' + (this.data.medicines.length + 101),
          barcode: '8901' + Math.floor(10000 + Math.random() * 90000),
          brandName: item.brandName,
          genericName: item.genericName || item.brandName,
          category: item.category || 'General Pharma',
          dosageForm: item.dosageForm || 'Tablet',
          strength: item.strength || '',
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          rack: item.rack || 'A-01',
          stock: parseInt(item.quantity, 10),
          unit: item.unit || 'Strip of 10',
          costPrice: parseFloat(item.costPrice),
          mrp: parseFloat(item.mrp || item.costPrice * 1.5),
          sellingPrice: parseFloat(item.sellingPrice || item.costPrice * 1.3),
          taxRate: parseFloat(item.taxRate || 5),
          isRxRequired: !!item.isRxRequired,
          reorderLevel: 20,
          supplierId
        };
        this.data.medicines.push(newMed);
      }
    });

    totalSubtotal = Math.round(totalSubtotal * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;
    const grandTotal = Math.round((totalSubtotal + totalTax) * 100) / 100;

    // Post Double Entry:
    // Debit: Inventory Asset (Subtotal)
    // Debit: Sales Tax / GST Input Credit (Tax)
    // Credit: Accounts Payable (Credit) or Cash/Bank
    const journalList = [
      { accountId: '1040', accountName: 'Pharmacy Inventory / Stock Asset', debit: totalSubtotal, credit: 0 },
      { accountId: '2020', accountName: 'Sales Tax / GST Payable', debit: totalTax, credit: 0 } // tax credit offsets liability
    ];

    if (paymentMethod === 'Cash') {
      journalList.push({ accountId: '1010', accountName: 'Cash in Hand (POS Drawer)', debit: 0, credit: grandTotal });
    } else if (paymentMethod === 'Bank') {
      journalList.push({ accountId: '1020', accountName: 'Main Bank Account (Operating)', debit: 0, credit: grandTotal });
    } else { // On Credit / AP
      journalList.push({ accountId: '2010', accountName: 'Accounts Payable (Drug Suppliers)', debit: 0, credit: grandTotal });
    }

    this.addJournalEntry({
      date: date || new Date().toISOString().split('T')[0],
      voucherType: 'Purchase Voucher',
      reference: invoiceNumber || ('BILL-' + Date.now().toString().slice(-5)),
      narration: `Inward pharmaceutical purchase bill from ${supplier.name}. ${notes || ''}`,
      supplierId,
      entries: journalList
    });

    this.save();
    return { success: true, grandTotal, invoiceNumber };
  }

  /**
   * Settle / Pay a Supplier Bill (Reduces Accounts Payable & Cash/Bank)
   */
  processSupplierPayment(supplierId, amount, paymentFrom, referenceNo, narration) {
    const supplier = this.data.suppliers.find(s => s.id === supplierId);
    if (!supplier) throw new Error('Supplier not found');

    const payAmount = Math.round(parseFloat(amount) * 100) / 100;
    if (payAmount <= 0) throw new Error('Payment amount must be greater than zero');

    const sourceAccountId = paymentFrom === 'Cash' ? '1010' : '1020';
    const sourceAccountName = paymentFrom === 'Cash' ? 'Cash in Hand (POS Drawer)' : 'Main Bank Account (Operating)';

    // Debit: Accounts Payable (Supplier)
    // Credit: Cash / Bank
    this.addJournalEntry({
      date: new Date().toISOString().split('T')[0],
      voucherType: 'Payment Voucher',
      reference: referenceNo || ('PAY-SUP-' + Date.now().toString().slice(-5)),
      narration: `Payment made to supplier ${supplier.name}. ${narration || ''}`,
      supplierId,
      entries: [
        { accountId: '2010', accountName: 'Accounts Payable (Drug Suppliers)', debit: payAmount, credit: 0 },
        { accountId: sourceAccountId, accountName: sourceAccountName, debit: 0, credit: payAmount }
      ]
    });

    return { success: true, newBalance: supplier.balancePayable };
  }

  /**
   * Receive Payment from Patient / Customer against Credit Ledger
   */
  processCustomerPayment(customerId, amount, paymentMode, referenceNo, narration, customDate = null) {
    const customer = this.data.customers.find(c => c.id === customerId);
    if (!customer) throw new Error('Customer not found');

    const recvAmount = Math.round(parseFloat(amount) * 100) / 100;
    if (recvAmount <= 0) throw new Error('Receipt amount must be greater than zero');

    const destAccountId = paymentMode === 'Cash' ? '1010' : '1020';
    const destAccountName = paymentMode === 'Cash' ? 'Cash in Hand (POS Drawer)' : 'Main Bank Account (Operating)';
    const now = new Date();
    const dateStr = customDate || now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const receiptRef = referenceNo || ('REC-PT-' + Date.now().toString().slice(-5));
    const isCash = paymentMode === 'Cash';

    // 1. Post to Double-Entry General Ledger
    // Debit: Cash / Bank
    // Credit: Accounts Receivable (Patient Credit)
    this.addJournalEntry({
      date: dateStr,
      voucherType: 'Receipt Voucher',
      reference: receiptRef,
      narration: `Credit payment received from patient ${customer.name}. ${narration || ''}`,
      customerId,
      entries: [
        { accountId: destAccountId, accountName: destAccountName, debit: recvAmount, credit: 0 },
        { accountId: '1030', accountName: 'Accounts Receivable (Patient Credit)', debit: 0, credit: recvAmount }
      ]
    });

    // 2. Record in Patient Credit Collections for Daily Records & Drawer
    if (!this.data.creditCollections) this.data.creditCollections = [];
    const collectionRecord = {
      id: 'CR-COL-' + Date.now().toString().slice(-6),
      receiptNo: receiptRef,
      date: dateStr,
      time: timeStr,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      amount: recvAmount,
      paymentMode: paymentMode,
      isCashDrawer: isCash,
      narration: narration || 'Payment collected for credit clearance',
      recordedBy: (window.Auth && Auth.currentUser) ? Auth.currentUser.name : 'Pharmacist',
      status: 'Collected',
      createdAt: now.toISOString()
    };
    this.data.creditCollections.unshift(collectionRecord);
    this.save();

    return { success: true, newBalance: customer.balance, collectionRecord };
  }

  /**
   * Quarantine / Write Off Expired or Damaged Medicines
   */
  processStockWriteOff(medicineId, quantity, reason, disposalMethod) {
    const med = this.data.medicines.find(m => m.id === medicineId);
    if (!med) throw new Error('Medicine not found');
    const qty = parseInt(quantity, 10);
    if (qty <= 0 || qty > med.stock) throw new Error(`Invalid write-off quantity (Current stock: ${med.stock})`);

    const lossAmount = Math.round((med.costPrice * qty) * 100) / 100;
    med.stock -= qty;

    // Debit: Medicine Expiry / Spoilage Loss (Expense)
    // Credit: Pharmacy Inventory Asset
    this.addJournalEntry({
      date: new Date().toISOString().split('T')[0],
      voucherType: 'Journal Voucher',
      reference: 'EXP-WO-' + Date.now().toString().slice(-5),
      narration: `Quarantine & write-off of ${qty} units of ${med.brandName} (Batch: ${med.batchNo}). Reason: ${reason}. Method: ${disposalMethod}`,
      entries: [
        { accountId: '5050', accountName: 'Medicine Expiry, Spoilage & Breakage Loss', debit: lossAmount, credit: 0 },
        { accountId: '1040', accountName: 'Pharmacy Inventory / Stock Asset', debit: 0, credit: lossAmount }
      ]
    });

    this.save();
    return { success: true, lossAmount, remainingStock: med.stock };
  }

  /* -------------------------------------------------------------
   * FINANCIAL STATEMENTS GENERATORS
   * ------------------------------------------------------------- */

  getTrialBalance() {
    this.recalculateAllAccountBalances();
    const rows = [];
    let totalDebit = 0;
    let totalCredit = 0;

    this.data.accounts.forEach(acc => {
      // Net debit and credit total for trial balance
      let dr = 0;
      let cr = 0;
      if (acc.normal === 'Debit') {
        if (acc.balance >= 0) dr = acc.balance;
        else cr = Math.abs(acc.balance);
      } else {
        if (acc.balance >= 0) cr = acc.balance;
        else dr = Math.abs(acc.balance);
      }

      if (dr > 0 || cr > 0) {
        rows.push({
          code: acc.code,
          name: acc.name,
          type: acc.type,
          debit: dr,
          credit: cr
        });
        totalDebit += dr;
        totalCredit += cr;
      }
    });

    return {
      rows,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.05
    };
  }

  getProfitAndLoss() {
    this.recalculateAllAccountBalances();
    
    // Operating Revenues
    const salesRev = this.getAccountBalance('4010');
    const serviceRev = this.getAccountBalance('4020');
    const discounts = this.getAccountBalance('4030'); // Contra revenue
    const netRevenue = salesRev + serviceRev - discounts;

    // Cost of Goods Sold
    const cogs = this.getAccountBalance('5010');
    const grossProfit = netRevenue - cogs;

    // Operating Expenses
    const expenses = [
      { name: 'Store Rent Expense', code: '5020', amount: this.getAccountBalance('5020') },
      { name: 'Salaries & Staff Wages', code: '5030', amount: this.getAccountBalance('5030') },
      { name: 'Electricity & Cold Chain Utilities', code: '5040', amount: this.getAccountBalance('5040') },
      { name: 'Medicine Expiry & Spoilage Loss', code: '5050', amount: this.getAccountBalance('5050') },
      { name: 'Licensing & Regulatory Compliance', code: '5060', amount: this.getAccountBalance('5060') },
      { name: 'Packaging, Prescription Bags & Labels', code: '5070', amount: this.getAccountBalance('5070') },
      { name: 'Bank Charges & POS Processing', code: '5080', amount: this.getAccountBalance('5080') }
    ];

    const totalOperatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossProfit - totalOperatingExpenses;

    return {
      salesRev,
      serviceRev,
      discounts,
      netRevenue,
      cogs,
      grossProfit,
      grossMarginPct: netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0,
      expenses,
      totalOperatingExpenses,
      netProfit,
      netMarginPct: netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0
    };
  }

  getBalanceSheet() {
    this.recalculateAllAccountBalances();
    const pnl = this.getProfitAndLoss();

    // Assets
    const currentAssets = [
      { name: 'Cash in Hand (POS Drawer)', code: '1010', amount: this.getAccountBalance('1010') },
      { name: 'Main Bank Account (Operating)', code: '1020', amount: this.getAccountBalance('1020') },
      { name: 'Accounts Receivable (Patient Credit)', code: '1030', amount: this.getAccountBalance('1030') },
      { name: 'Pharmacy Inventory / Stock Asset', code: '1040', amount: this.getAccountBalance('1040') }
    ];
    const fixedAssets = [
      { name: 'Pharmacy Fixtures, Cold Chain & POS Hardware', code: '1510', amount: this.getAccountBalance('1510') }
    ];

    const totalCurrentAssets = currentAssets.reduce((s, a) => s + a.amount, 0);
    const totalFixedAssets = fixedAssets.reduce((s, a) => s + a.amount, 0);
    const totalAssets = totalCurrentAssets + totalFixedAssets;

    // Liabilities
    const currentLiabilities = [
      { name: 'Accounts Payable (Drug Suppliers)', code: '2010', amount: this.getAccountBalance('2010') },
      { name: 'Sales Tax / GST Payable', code: '2020', amount: this.getAccountBalance('2020') },
      { name: 'Accrued Wages & Liabilities', code: '2030', amount: this.getAccountBalance('2030') }
    ];
    const totalLiabilities = currentLiabilities.reduce((s, l) => s + l.amount, 0);

    // Equity
    const baseEquity = this.getAccountBalance('3010');
    const retainedEarnings = this.getAccountBalance('3020');
    const drawings = this.getAccountBalance('3030');
    const currentPeriodNetIncome = pnl.netProfit;
    const totalEquity = (baseEquity + retainedEarnings + currentPeriodNetIncome) - drawings;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      currentAssets,
      totalCurrentAssets,
      fixedAssets,
      totalFixedAssets,
      totalAssets,
      currentLiabilities,
      totalLiabilities,
      equity: {
        baseEquity,
        retainedEarnings,
        currentPeriodNetIncome,
        drawings,
        totalEquity
      },
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1.00
    };
  }

  getAccountBalance(id) {
    const acc = this.data.accounts.find(a => a.id === id);
    return acc ? acc.balance : 0;
  }

  getGeneralLedgerForAccount(accountId) {
    const acc = this.data.accounts.find(a => a.id === accountId);
    if (!acc) return null;

    const transactions = [];
    let runningBalance = 0;

    this.data.journalEntries.forEach(journal => {
      journal.entries.forEach(entry => {
        if (entry.accountId === accountId) {
          const dr = entry.debit || 0;
          const cr = entry.credit || 0;
          if (acc.normal === 'Debit') {
            runningBalance += (dr - cr);
          } else {
            runningBalance += (cr - dr);
          }

          transactions.push({
            journalId: journal.id,
            date: journal.date,
            voucherType: journal.voucherType,
            reference: journal.reference,
            narration: journal.narration,
            debit: dr,
            credit: cr,
            runningBalance: Math.round(runningBalance * 100) / 100
          });
        }
      });
    });

    return {
      account: acc,
      transactions,
      finalBalance: Math.round(runningBalance * 100) / 100
    };
  }
}

// Global instance
window.pharmacyDB = new PharmacyDatabase();
