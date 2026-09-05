-- ============================================================
-- Abyte Dinex - Complete Database Schema
-- Last updated: 2026-04-21
-- Usage: mysql -u root -p <db_name> < schema.sql
-- Note: CREATE DATABASE and USE are handled by the app
-- ============================================================

-- ============================================================
-- LEVEL 0: No foreign key dependencies
-- ============================================================

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

INSERT IGNORE INTO roles (role_name) VALUES ('Admin');

-- Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    permission_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) NOT NULL,
    module_key VARCHAR(100) NOT NULL,
    is_allowed TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role_module (role_name, module_key),
    INDEX idx_role (role_name)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL,
    category_type ENUM('raw_material','semi_finished','finished_good') NOT NULL DEFAULT 'finished_good',
    parent_id INT NULL,
    description TEXT,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_category_name (category_name)
);

-- Variant Types (e.g. Size, Color)
CREATE TABLE IF NOT EXISTS variant_types (
    variant_type_id INT PRIMARY KEY AUTO_INCREMENT,
    variant_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- LEVEL 1: Depends on Level 0
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    INDEX idx_user_username (username),
    INDEX idx_user_active (is_active)
);

-- Variant Values (e.g. Small, Medium, Red, Blue)
CREATE TABLE IF NOT EXISTS variant_values (
    variant_value_id INT PRIMARY KEY AUTO_INCREMENT,
    variant_type_id INT NOT NULL,
    value_name VARCHAR(50) NOT NULL,
    FOREIGN KEY (variant_type_id) REFERENCES variant_types(variant_type_id) ON DELETE CASCADE
);


-- ============================================================
-- LEVEL 2: Depends on Level 1
-- ============================================================

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_name VARCHAR(100),
    phone_number VARCHAR(20),
    email VARCHAR(150),
    company VARCHAR(150),
    tax_id VARCHAR(50),
    address TEXT,
    address_1 TEXT,
    address_2 TEXT,
    address_3 TEXT,
    address_4 TEXT,
    balance DECIMAL(12,2) DEFAULT 0.00,
    credit_limit DECIMAL(12,2) DEFAULT 0.00,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_customer_phone (phone_number),
    INDEX idx_customer_name (customer_name),
    INDEX idx_customer_deleted (deleted_at),
    FULLTEXT INDEX idx_customer_search (customer_name)
);

INSERT IGNORE INTO customers (customer_id, customer_name, phone_number) VALUES (1, 'Walk-in Customer', NULL);

-- Customer Addresses (multi-address support)
CREATE TABLE IF NOT EXISTS customer_addresses (
    address_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    address_text TEXT NOT NULL,
    label VARCHAR(50) DEFAULT NULL,
    is_default TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_customer_address (customer_id)
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    product_id INT PRIMARY KEY AUTO_INCREMENT,
    product_name VARCHAR(200) NOT NULL,
    category_id INT,
    product_type ENUM('finished_good','raw_material','semi_finished') NOT NULL DEFAULT 'finished_good',
    unit VARCHAR(50) DEFAULT 'pcs',
    price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) DEFAULT NULL,
    cost_price DECIMAL(15, 2) DEFAULT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    reorder_level INT DEFAULT NULL,
    min_stock_level INT DEFAULT NULL,
    has_variants TINYINT(1) DEFAULT 0,
    sku VARCHAR(100) DEFAULT NULL,
    barcode VARCHAR(100) UNIQUE,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    INDEX idx_product_name (product_name),
    INDEX idx_product_category (category_id),
    INDEX idx_product_active (is_active),
    INDEX idx_product_deleted (deleted_at),
    INDEX idx_product_sku (sku),
    FULLTEXT INDEX idx_product_search (product_name),
    CONSTRAINT chk_product_price CHECK (price >= 0),
    CONSTRAINT chk_product_cost CHECK (cost_price IS NULL OR cost_price >= 0)
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    tax_id VARCHAR(50),
    payment_terms VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_supplier_name (supplier_name),
    INDEX idx_supplier_active (is_active)
);

-- Sections (departments for stock issuance)
CREATE TABLE IF NOT EXISTS sections (
    section_id INT PRIMARY KEY AUTO_INCREMENT,
    section_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store Settings
CREATE TABLE IF NOT EXISTS store_settings (
    setting_id INT PRIMARY KEY AUTO_INCREMENT,
    store_name VARCHAR(255) DEFAULT 'Abyte Dinex Store',
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    website VARCHAR(100),
    receipt_header TEXT,
    receipt_footer TEXT DEFAULT 'Thank you for shopping with us!',
    tax_rate DECIMAL(5,2) DEFAULT 0,
    currency_symbol VARCHAR(10) DEFAULT 'Rs.',
    receipt_logo TEXT,
    low_stock_threshold INT DEFAULT 10,
    default_payment_method ENUM('cash','card','online') DEFAULT 'cash',
    auto_print_receipt TINYINT(1) DEFAULT 0,
    barcode_prefix VARCHAR(10) DEFAULT '',
    invoice_prefix VARCHAR(20) DEFAULT 'INV-',
    date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    timezone VARCHAR(50) DEFAULT 'Asia/Karachi',
    business_hours_open TIME DEFAULT '09:00:00',
    business_hours_close TIME DEFAULT '21:00:00',
    allow_negative_stock TINYINT(1) DEFAULT 0,
    discount_requires_approval TINYINT(1) DEFAULT 0,
    max_cashier_discount DECIMAL(5,2) DEFAULT 50.00,
    session_timeout_minutes INT DEFAULT 480,
    receipt_show_store_name TINYINT(1) DEFAULT 1,
    receipt_show_address TINYINT(1) DEFAULT 1,
    receipt_show_phone TINYINT(1) DEFAULT 1,
    receipt_show_tax TINYINT(1) DEFAULT 1,
    receipt_paper_width ENUM('58mm','80mm') DEFAULT '80mm',
    printer_type ENUM('none','network','usb') DEFAULT 'none',
    printer_ip VARCHAR(100) DEFAULT NULL,
    printer_port INT DEFAULT 9100,
    printer_name VARCHAR(255) DEFAULT NULL,
    printer_paper_width INT DEFAULT 80,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO store_settings (setting_id, store_name, receipt_footer)
VALUES (1, 'Abyte Dinex Store', 'Thank you for shopping with us!');

-- Printers
CREATE TABLE IF NOT EXISTS printers (
    printer_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    type ENUM('network','usb') NOT NULL,
    ip_address VARCHAR(100) DEFAULT NULL,
    port INT DEFAULT 9100,
    printer_share_name VARCHAR(255) DEFAULT NULL,
    paper_width INT DEFAULT 80,
    purpose VARCHAR(50) NOT NULL DEFAULT 'receipt',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Backups
CREATE TABLE IF NOT EXISTS backups (
    backup_id INT PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type ENUM('manual', 'scheduled') DEFAULT 'manual',
    status ENUM('completed', 'failed') DEFAULT 'completed',
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);


-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    user_id INT,
    user_name VARCHAR(100),
    details TEXT,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_audit_action (action),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_created (created_at)
);


-- ============================================================
-- INVENTORY MODULE
-- ============================================================

-- Inventory (global stock + avg cost)
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL UNIQUE,
    available_stock INT NOT NULL DEFAULT 0,
    avg_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Stock Layers (FIFO cost tracking)
CREATE TABLE IF NOT EXISTS stock_layers (
    layer_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    pv_id INT NULL,
    source_type ENUM('purchase','opening','adjustment') NOT NULL DEFAULT 'purchase',
    ref_date DATE NOT NULL,
    qty_original DECIMAL(15,3) NOT NULL,
    qty_remaining DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sl_product (product_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- Opening Stock Entries
CREATE TABLE IF NOT EXISTS opening_stock_entries (
    entry_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
    entry_date DATE NOT NULL,
    notes VARCHAR(255),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Stock Alerts
CREATE TABLE IF NOT EXISTS stock_alerts (
    alert_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    alert_type ENUM('low_stock', 'out_of_stock', 'overstock') NOT NULL,
    threshold_value INT,
    current_stock INT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    INDEX idx_alert_active (is_active),
    INDEX idx_alert_product (product_id)
);

-- Stock Adjustments
CREATE TABLE IF NOT EXISTS stock_adjustments (
    adjustment_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    variant_id INT NULL,
    store_id INT DEFAULT 1,
    adjustment_type ENUM('addition','subtraction','correction','damage','theft','return','opening_stock','expired') NOT NULL,
    quantity_before INT NOT NULL,
    quantity_adjusted INT NOT NULL,
    quantity_after INT NOT NULL,
    reason TEXT,
    reference_number VARCHAR(100),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_adj_product (product_id),
    INDEX idx_adj_type (adjustment_type),
    INDEX idx_adj_date (created_at)
);

-- Stock Issues (issue stock to section)
CREATE TABLE IF NOT EXISTS stock_issues (
    issue_id INT PRIMARY KEY AUTO_INCREMENT,
    issue_number VARCHAR(30) NOT NULL UNIQUE,
    section_id INT NOT NULL,
    issue_date DATE NOT NULL,
    notes TEXT,
    status ENUM('draft','issued') DEFAULT 'issued',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(section_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Stock Issue Items
CREATE TABLE IF NOT EXISTS stock_issue_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    issue_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (issue_id) REFERENCES stock_issues(issue_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Stock Issue Returns
CREATE TABLE IF NOT EXISTS stock_issue_returns (
    return_id INT PRIMARY KEY AUTO_INCREMENT,
    return_number VARCHAR(30) NOT NULL UNIQUE,
    section_id INT NOT NULL,
    return_date DATE NOT NULL,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(section_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Stock Issue Return Items
CREATE TABLE IF NOT EXISTS stock_issue_return_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    return_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    FOREIGN KEY (return_id) REFERENCES stock_issue_returns(return_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id INT PRIMARY KEY AUTO_INCREMENT,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_id INT NOT NULL,
    order_date DATE NOT NULL,
    expected_date DATE,
    received_date DATE,
    status ENUM('draft', 'pending', 'received', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(15, 2) NOT NULL,
    additional_charges DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    created_by INT NOT NULL,
    store_id INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_po_number (po_number),
    INDEX idx_po_status (status),
    INDEX idx_po_supplier (supplier_id)
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    po_item_id INT PRIMARY KEY AUTO_INCREMENT,
    po_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity_ordered INT NOT NULL,
    quantity_received INT DEFAULT 0,
    unit_cost DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    INDEX idx_po_item_po (po_id),
    INDEX idx_po_item_product (product_id)
);

-- Purchase Vouchers / GRN (Goods Received Notes)
CREATE TABLE IF NOT EXISTS inv_purchase_vouchers (
    pv_id INT PRIMARY KEY AUTO_INCREMENT,
    pv_number VARCHAR(30) NOT NULL UNIQUE,
    po_id INT,
    supplier_id INT,
    purchase_account_id INT NULL,
    payable_account_id INT NULL,
    journal_entry_id INT NULL,
    voucher_date DATE NOT NULL,
    total_amount DECIMAL(15,2) DEFAULT 0,
    shipping_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    extra_charges DECIMAL(15,2) NOT NULL DEFAULT 0,
    other_charges DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Purchase Voucher Items
CREATE TABLE IF NOT EXISTS inv_purchase_voucher_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    pv_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity_received DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (pv_id) REFERENCES inv_purchase_vouchers(pv_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Purchase Returns (return to supplier)
CREATE TABLE IF NOT EXISTS purchase_returns (
    pr_id INT PRIMARY KEY AUTO_INCREMENT,
    pr_number VARCHAR(30) NOT NULL UNIQUE,
    pv_id INT,
    supplier_id INT,
    return_date DATE NOT NULL,
    total_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pv_id) REFERENCES inv_purchase_vouchers(pv_id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Purchase Return Items
CREATE TABLE IF NOT EXISTS purchase_return_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    pr_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity_returned DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (pr_id) REFERENCES purchase_returns(pr_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Supplier Payments
CREATE TABLE IF NOT EXISTS supplier_payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_id INT NOT NULL,
    purchase_order_id INT,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash', 'bank_transfer', 'cheque', 'credit') DEFAULT 'cash',
    reference_number VARCHAR(100),
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_payment_date (payment_date),
    INDEX idx_payment_supplier (supplier_id)
);

-- ============================================================
-- SALES MODULE
-- ============================================================

-- Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
    variant_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    variant_name VARCHAR(200),
    price_adjustment DECIMAL(10, 2) DEFAULT 0.00,
    stock_quantity INT NOT NULL DEFAULT 0,
    barcode VARCHAR(100) UNIQUE,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_product_variants_product_id (product_id)
);

-- Product Bundles
CREATE TABLE IF NOT EXISTS product_bundles (
    bundle_id INT PRIMARY KEY AUTO_INCREMENT,
    bundle_name VARCHAR(200) NOT NULL,
    description TEXT,
    discount_type ENUM('percentage', 'fixed_price', 'fixed_amount') NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    start_date DATE,
    end_date DATE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_product_bundles_active (is_active)
);

-- Also created in migration v8 for upgrades
-- Restaurant Tables (dine-in table management)
CREATE TABLE IF NOT EXISTS restaurant_tables (
    table_id INT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(50) NOT NULL,
    floor VARCHAR(50) DEFAULT 'Main',
    capacity INT DEFAULT 4,
    status ENUM('available', 'occupied') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
    sale_id INT PRIMARY KEY AUTO_INCREMENT,
    sub_total DECIMAL(10,2) DEFAULT 0,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0.00,
    bundle_discount DECIMAL(10, 2) DEFAULT 0.00,
    bundle_count INT DEFAULT 0,
    net_amount DECIMAL(10, 2) NOT NULL,
    user_id INT NOT NULL,
    customer_id INT DEFAULT 1,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    status VARCHAR(20) DEFAULT 'completed',
    tax_percent DECIMAL(5, 2) DEFAULT 0.00,
    additional_charges_percent DECIMAL(5, 2) DEFAULT 0.00,
    additional_charges_amount DECIMAL(10, 2) DEFAULT 0.00,
    note TEXT,
    amount_paid DECIMAL(10, 2) DEFAULT 0.00,
    token_no VARCHAR(20) NULL,
    invoice_no VARCHAR(20) NULL,
    table_id INT NULL,
    order_type VARCHAR(30) NULL DEFAULT 'on_spot',
    customer_name VARCHAR(100) NULL,
    customer_phone VARCHAR(20) NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    INDEX idx_sale_date (sale_date),
    INDEX idx_sale_status (status),
    INDEX idx_sale_payment_method (payment_method),
    INDEX idx_sale_date_status (sale_date, status)
);

-- Sale Details
CREATE TABLE IF NOT EXISTS sale_details (
    sale_detail_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT,
    variant_name VARCHAR(200),
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10, 2) NOT NULL,
    profit DECIMAL(10,2) DEFAULT NULL,
    note TEXT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    INDEX idx_sale_details_sale_id (sale_id),
    INDEX idx_sale_details_product_id (product_id),
    INDEX idx_sale_details_variant_id (variant_id),
    CONSTRAINT chk_sd_quantity CHECK (quantity > 0),
    CONSTRAINT chk_sd_price CHECK (unit_price >= 0),
    CONSTRAINT chk_sd_total CHECK (total_price >= 0)
);

-- Sale Bundles
CREATE TABLE IF NOT EXISTS sale_bundles (
    sale_bundle_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    bundle_id INT NOT NULL,
    bundle_name VARCHAR(200) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (bundle_id) REFERENCES product_bundles(bundle_id),
    INDEX idx_sale_bundles_sale_id (sale_id),
    INDEX idx_sale_bundles_bundle_id (bundle_id)
);

-- Returns (customer returns)
CREATE TABLE IF NOT EXISTS returns (
    return_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    refund_amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    user_id INT,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_return_date (return_date),
    INDEX idx_return_sale (sale_id)
);

-- Return Details
CREATE TABLE IF NOT EXISTS return_details (
    return_detail_id INT PRIMARY KEY AUTO_INCREMENT,
    return_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    refund_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (return_id) REFERENCES returns(return_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Raw Sales (direct raw material sales)
CREATE TABLE IF NOT EXISTS raw_sales (
    sale_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_number VARCHAR(30) NOT NULL UNIQUE,
    section_id INT,
    customer_name VARCHAR(100),
    sale_date DATE NOT NULL,
    total_amount DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(section_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Raw Sale Items
CREATE TABLE IF NOT EXISTS raw_sale_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES raw_sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Print Queue (for browser-based printing via polling)
CREATE TABLE IF NOT EXISTS print_queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(50) NOT NULL DEFAULT 'invoice',
    payload JSON NOT NULL,
    status ENUM('pending','printing','done','failed') NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    INDEX idx_print_status (status)
);

-- Cash Registers
CREATE TABLE IF NOT EXISTS cash_registers (
    register_id INT PRIMARY KEY AUTO_INCREMENT,
    opened_by INT NOT NULL,
    closed_by INT,
    opening_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    closing_balance DECIMAL(10, 2),
    expected_balance DECIMAL(10, 2),
    cash_sales_total DECIMAL(10, 2) DEFAULT 0.00,
    card_sales_total DECIMAL(10, 2) DEFAULT 0.00,
    total_cash_in DECIMAL(10, 2) DEFAULT 0.00,
    total_cash_out DECIMAL(10, 2) DEFAULT 0.00,
    difference DECIMAL(10, 2),
    status ENUM('open', 'closed') DEFAULT 'open',
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    close_note TEXT,
    FOREIGN KEY (opened_by) REFERENCES users(user_id),
    FOREIGN KEY (closed_by) REFERENCES users(user_id),
    INDEX idx_register_status (status)
);

-- Cash Movements
CREATE TABLE IF NOT EXISTS cash_movements (
    movement_id INT PRIMARY KEY AUTO_INCREMENT,
    register_id INT NOT NULL,
    type ENUM('cash_in', 'cash_out') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (register_id) REFERENCES cash_registers(register_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Quotations
CREATE TABLE IF NOT EXISTS quotations (
    quotation_id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted') DEFAULT 'draft',
    valid_until DATE,
    notes TEXT,
    converted_sale_id INT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_quotation_status (status),
    INDEX idx_quotation_customer (customer_id)
);

-- Quotation Items
CREATE TABLE IF NOT EXISTS quotation_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Credit Sales
CREATE TABLE IF NOT EXISTS credit_sales (
    credit_sale_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    customer_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    balance DECIMAL(10,2) NOT NULL,
    balance_due DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('pending', 'partial', 'paid', 'overdue') DEFAULT 'pending',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_credit_status (status),
    INDEX idx_credit_customer (customer_id),
    INDEX idx_credit_due_date (due_date),
    CONSTRAINT chk_credit_amounts CHECK (total_amount >= 0 AND paid_amount >= 0)
);

-- Credit Payments
CREATE TABLE IF NOT EXISTS credit_payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    credit_sale_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    received_by INT,
    notes TEXT,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (credit_sale_id) REFERENCES credit_sales(credit_sale_id),
    FOREIGN KEY (received_by) REFERENCES users(user_id)
);

-- Price Rules
CREATE TABLE IF NOT EXISTS price_rules (
    rule_id INT PRIMARY KEY AUTO_INCREMENT,
    rule_name VARCHAR(200) NOT NULL,
    rule_type ENUM('buy_x_get_y', 'quantity_discount', 'time_based', 'category_discount') NOT NULL,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    priority INT DEFAULT 0,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    min_quantity INT DEFAULT 1,
    buy_quantity INT NULL,
    get_quantity INT NULL,
    discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
    discount_value DECIMAL(10,2) NOT NULL,
    max_uses INT NULL,
    used_count INT DEFAULT 0,
    applies_to ENUM('all', 'product', 'category') DEFAULT 'all',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_pr_active (is_active),
    INDEX idx_pr_dates (start_date, end_date),
    INDEX idx_pr_type (rule_type)
);

-- Price Rule Products
CREATE TABLE IF NOT EXISTS price_rule_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rule_id INT NOT NULL,
    product_id INT NULL,
    category_id INT NULL,
    FOREIGN KEY (rule_id) REFERENCES price_rules(rule_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- Price Rule Usage
CREATE TABLE IF NOT EXISTS price_rule_usage (
    usage_id INT PRIMARY KEY AUTO_INCREMENT,
    rule_id INT NOT NULL,
    sale_id INT NOT NULL,
    discount_applied DECIMAL(10,2) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES price_rules(rule_id),
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
);

-- Sales Targets
CREATE TABLE IF NOT EXISTS sales_targets (
    target_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    target_type ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'monthly',
    target_amount DECIMAL(12,2) NOT NULL,
    target_orders INT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_target_user (user_id),
    INDEX idx_target_period (period_start, period_end),
    INDEX idx_target_active (is_active)
);

-- Target Achievements
CREATE TABLE IF NOT EXISTS target_achievements (
    achievement_id INT PRIMARY KEY AUTO_INCREMENT,
    target_id INT NOT NULL,
    achievement_date DATE NOT NULL,
    actual_amount DECIMAL(12,2) DEFAULT 0,
    actual_orders INT DEFAULT 0,
    achievement_percentage DECIMAL(5,2) DEFAULT 0,
    FOREIGN KEY (target_id) REFERENCES sales_targets(target_id) ON DELETE CASCADE,
    UNIQUE KEY unique_target_date (target_id, achievement_date)
);

-- Deliveries
CREATE TABLE IF NOT EXISTS deliveries (
    delivery_id INT PRIMARY KEY AUTO_INCREMENT,
    delivery_number VARCHAR(50) NOT NULL UNIQUE,
    sale_id INT NULL,
    customer_id INT NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_city VARCHAR(100) DEFAULT '',
    delivery_phone VARCHAR(20) DEFAULT '',
    rider_name VARCHAR(100) DEFAULT '',
    rider_phone VARCHAR(20) DEFAULT '',
    status ENUM('pending','assigned','dispatched','in_transit','delivered','failed','cancelled') NOT NULL DEFAULT 'pending',
    delivery_charges DECIMAL(10,2) DEFAULT 0,
    estimated_delivery DATE NULL,
    actual_delivery TIMESTAMP NULL,
    notes TEXT,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_del_status (status),
    INDEX idx_del_customer (customer_id),
    INDEX idx_del_number (delivery_number),
    INDEX idx_del_date (created_at)
);

-- ============================================================
-- VARIANT & BUNDLE TABLES
-- ============================================================

-- Variant Combinations
CREATE TABLE IF NOT EXISTS variant_combinations (
    combination_id INT PRIMARY KEY AUTO_INCREMENT,
    variant_id INT NOT NULL,
    variant_value_id INT NOT NULL,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_value_id) REFERENCES variant_values(variant_value_id),
    INDEX idx_variant_combinations_variant_id (variant_id)
);

-- Variant Inventory
CREATE TABLE IF NOT EXISTS variant_inventory (
    variant_inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    variant_id INT NOT NULL UNIQUE,
    available_stock INT NOT NULL DEFAULT 0,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE
);

-- Bundle Items
CREATE TABLE IF NOT EXISTS bundle_items (
    bundle_item_id INT PRIMARY KEY AUTO_INCREMENT,
    bundle_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT,
    quantity_required INT NOT NULL DEFAULT 1,
    FOREIGN KEY (bundle_id) REFERENCES product_bundles(bundle_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE SET NULL,
    INDEX idx_bundle_items_bundle_id (bundle_id),
    INDEX idx_bundle_items_product_id (product_id)
);


-- ── MANUFACTURING / RECIPE SYSTEM ──────────────────────────────

-- Recipes: defines how to produce a finished_good or semi_finished product
CREATE TABLE IF NOT EXISTS recipes (
    recipe_id INT PRIMARY KEY AUTO_INCREMENT,
    recipe_name VARCHAR(255) NOT NULL,
    output_product_id INT NOT NULL,
    output_quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
    notes TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (output_product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
    INDEX idx_recipes_output (output_product_id)
);

-- Recipe Ingredients: raw_material or semi_finished items needed per batch
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    ingredient_id INT PRIMARY KEY AUTO_INCREMENT,
    recipe_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit VARCHAR(50),
    FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
    INDEX idx_recipe_ingredients_recipe (recipe_id)
);

-- Production Orders: a manufacturing run that consumes ingredients and adds output stock
CREATE TABLE IF NOT EXISTS production_orders (
    production_id INT PRIMARY KEY AUTO_INCREMENT,
    recipe_id INT NOT NULL,
    batches DECIMAL(10,3) NOT NULL DEFAULT 1,
    output_quantity DECIMAL(10,3) NOT NULL,
    status ENUM('completed','cancelled') DEFAULT 'completed',
    notes TEXT,
    produced_by INT,
    produced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE RESTRICT,
    FOREIGN KEY (produced_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_production_orders_recipe (recipe_id)
);
