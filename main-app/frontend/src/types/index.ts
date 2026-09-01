// =============================================================
// types/index.ts - Shared TypeScript types for Abyte ERP
// Replace 'any' usages with these concrete types.
// =============================================================

// ── Auth ──────────────────────────────────────────────────────
export interface User {
  user_id: number;
  username: string;
  name: string;
  email: string;
  role_name: 'Admin' | 'Manager' | 'Cashier' | 'Staff';
  is_active: 0 | 1;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  permissions: string[] | null;
  modules: string[];
}

// ── Pagination ────────────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data?: T[];
  pagination?: PaginationMeta;
}

// ── Product ───────────────────────────────────────────────────
export interface Product {
  product_id: number;
  product_name: string;
  category_id: number | null;
  category_name?: string;
  product_type: 'finished_good' | 'raw_material' | 'semi_finished';
  unit: string;
  price: number;
  selling_price?: number;
  cost_price: number | null;
  stock_quantity: number;
  available_stock?: number;
  reorder_level?: number;
  min_stock_level?: number;
  has_variants: 0 | 1;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  is_active: 0 | 1;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Customer ──────────────────────────────────────────────────
export interface Customer {
  customer_id: number;
  customer_name: string;
  phone_number: string | null;
  email: string | null;
  company: string | null;
  tax_id: string | null;
  address_1: string | null;
  balance?: number;
  credit_limit?: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Sale ──────────────────────────────────────────────────────
export interface SaleItem {
  product_id: number;
  product_name?: string;
  variant_id?: number | null;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
  discount?: number;
  total_price: number;
}

export interface Sale {
  sale_id: number;
  sale_date: string;
  customer_id: number;
  customer_name?: string;
  total_amount: number;
  net_amount: number;
  sub_total?: number;
  discount: number;
  tax_amount: number;
  tax_percent?: number;
  payment_method: string;
  status: 'completed' | 'refunded' | 'pending';
  note?: string | null;
  token_no?: string | null;
  invoice_no?: string | null;
  profit?: number;
  items?: SaleItem[];
}

// ── Staff ─────────────────────────────────────────────────────
export interface Staff {
  staff_id: number;
  user_id: number | null;
  employee_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  department?: string | null;
  department_id?: number | null;
  department_name?: string;
  basic_salary?: number;
  salary: number | null;
  salary_type: 'hourly' | 'daily' | 'monthly';
  hire_date: string;
  employment_status?: 'active' | 'inactive' | 'terminated';
  is_active: 0 | 1;
  leave_balance: number;
}

// ── Supplier ──────────────────────────────────────────────────
export interface Supplier {
  supplier_id: number;
  supplier_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  payment_terms: string | null;
  balance?: number;
  is_active: 0 | 1;
}

// ── Store / Branch ────────────────────────────────────────────
export interface Store {
  store_id: number;
  store_name: string;
  store_code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  manager_id: number | null;
  monthly_charge: number;
  is_active: 0 | 1;
}

// ── API Error ─────────────────────────────────────────────────
export interface ApiError {
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

// ── Generic select option ─────────────────────────────────────
export interface SelectOption {
  value: string | number;
  label: string;
}
