// =============================================================
// moduleGuard.js - Module-based Access Control
// Sub-module keys must match sidebar moduleKey values in Layout.tsx
// Backward compatible: old tenants with ["sales"] get all sub-modules.
// =============================================================

const MODULES = {
  sales: {
    key: 'sales',
    name: 'Sale',
    price: 2250,
    description: 'POS, Orders, Returns, Credit Sales, Quotations, Deliveries',
    subModules: [
      { key: 'sales.pos',        label: 'Point of Sale & Orders' },
      { key: 'sales.orders',     label: 'Done Orders' },
      { key: 'sales.register',   label: 'Cash Register' },
      { key: 'sales.deliveries', label: 'Deliveries' },
      { key: 'sales.returns',    label: 'Sales Returns' },
      { key: 'sales.quotations', label: 'Quotations' },
      { key: 'sales.credit',     label: 'Credit Sales' },
      { key: 'sales.pricerules', label: 'Price Rules' },
      { key: 'sales.targets',    label: 'Sales Targets' },
      { key: 'sales.reports',    label: 'Reports & Analytics' },
      { key: 'sales.customers',  label: 'Customers' },
    ],
  },
  inventory: {
    key: 'inventory',
    name: 'Inventory',
    price: 2250,
    description: 'Products, Stock, Purchase Orders, GRN, Suppliers',
    subModules: [
      { key: 'inventory.products',    label: 'Products & Opening Stock' },
      { key: 'inventory.categories',  label: 'Categories' },
      { key: 'inventory.bundles',     label: 'Deals & Bundles' },
      { key: 'inventory.purchases',   label: 'Purchase Orders & Vouchers' },
      { key: 'inventory.suppliers',   label: 'Suppliers' },
      { key: 'inventory.adjustments', label: 'Stock Adjustments & Issuance' },
      { key: 'inventory.reports',     label: 'Inventory Reports' },
    ],
  },
  accounts: {
    key: 'accounts',
    name: 'Accounts',
    price: 2999,
    description: 'Journal Entries, Vouchers, Bank Accounts, Ledger',
    subModules: [
      { key: 'accounts.chart',            label: 'Chart of Accounts' },
      { key: 'accounts.journal',          label: 'Journal Voucher' },
      { key: 'accounts.payment-vouchers', label: 'Payment & Receipt Vouchers' },
      { key: 'accounts.ledger',           label: 'Ledger, Trial Balance & Reports' },
      { key: 'accounts.bank',             label: 'Bank Accounts' },
      { key: 'accounts.analytics',        label: 'Analytics & Reports' },
    ],
  },
  hr: {
    key: 'hr',
    name: 'HR & Payroll',
    price: 2999,
    description: 'Staff, Attendance, Salary, Leaves, Loans',
    subModules: [
      { key: 'hr.staff',             label: 'Staff Management' },
      { key: 'hr.attendance',        label: 'Attendance & Biometric' },
      { key: 'hr.payroll',           label: 'Payroll & Salary' },
      { key: 'hr.salary-components', label: 'Salary Components' },
      { key: 'hr.leaves',            label: 'Leave Management' },
      { key: 'hr.loans',             label: 'Loans' },
      { key: 'hr.reports',           label: 'Reports & Ledger' },
    ],
  },
};

// Legacy plan support
const PLAN_MODULES = {
  basic:        ['sales', 'inventory'],
  professional: ['sales', 'inventory', 'accounts'],
  enterprise:   ['sales', 'inventory', 'accounts', 'hr'],
};

// Backward-compatible check:
//   Old format ["sales"]: parent key grants all sub-modules
//   New format ["sales.pos", "sales.returns"]: exact match required
const hasModuleAccess = (modules, key) => {
  if (!Array.isArray(modules) || modules.length === 0) return false;
  if (modules.includes(key)) return true;

  const parent = key.split('.')[0];
  const isSubKey = key.includes('.');

  if (isSubKey) {
    const hasParent = modules.includes(parent);
    const hasAnySubOfParent = modules.some(m => m.startsWith(parent + '.'));
    if (hasParent && !hasAnySubOfParent) return true;
  } else {
    if (modules.some(m => m.startsWith(key + '.'))) return true;
  }
  return false;
};

// Phase 4: Single-tenant — all modules enabled, no gating.
const requireModule = (_moduleName) => (_req, _res, next) => next();

// Counts unique parent modules only (bundle pricing)
const calculatePrice = (selectedModules = []) => {
  const parentKeys = new Set(selectedModules.map(m => m.split('.')[0]));
  return [...parentKeys].reduce((total, key) => {
    return total + (MODULES[key]?.price || 0);
  }, 0);
};

const getModuleList = () => Object.values(MODULES);
const getPlanModules = (plan) => PLAN_MODULES[plan] || PLAN_MODULES.basic;
const isModuleAllowed = (modulesEnabled, moduleName) => {
  if (!modulesEnabled) return true;
  return hasModuleAccess(modulesEnabled, moduleName);
};

const getDefaultSubModules = (parentKey) => {
  return (MODULES[parentKey]?.subModules || []).map(s => s.key);
};

const expandToSubModules = (modules = []) => {
  const result = [];
  modules.forEach(m => {
    if (!m.includes('.')) {
      result.push(...getDefaultSubModules(m));
    } else {
      result.push(m);
    }
  });
  return [...new Set(result)];
};

module.exports = {
  requireModule,
  calculatePrice,
  getModuleList,
  getPlanModules,
  isModuleAllowed,
  hasModuleAccess,
  getDefaultSubModules,
  expandToSubModules,
  PLAN_MODULES,
  MODULES,
};
