// =============================================================
// migrationService.js - Numbered Database Migration Runner
// Replaces scattered ALTER TABLE calls in controllers.
// Each migration runs once per tenant DB, tracked in schema_migrations table.
// =============================================================

const { queryDb } = require('../config/database');
const logger = require('../config/logger');

// All migrations in order — add new ones at the bottom
const MIGRATIONS = [
  {
    version: 1,
    name: 'consolidate_schema_drift',
    async run(db) {
      const stmts = [
        // Sales
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS table_id INT NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) NULL DEFAULT 'on_spot'`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS token_no VARCHAR(20) NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(20) NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS bundle_discount DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS bundle_count INT DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS sub_total DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_synced TINYINT(1) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS synced_at DATETIME NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS profit DECIMAL(10,2) DEFAULT 0.00`,
        // Products
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10,2) DEFAULT NULL`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INT DEFAULT NULL`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL`,
        // Categories
        `ALTER TABLE categories ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        // Users
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        // Customers
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS balance DECIMAL(12,2) DEFAULT 0.00`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2) DEFAULT 0.00`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL`,
        // Credit Sales
        `ALTER TABLE credit_sales ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE credit_sales ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT NULL`,
        // Other tables
        `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE stock_issues ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE stock_issue_returns ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE raw_sales ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE returns ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        // Purchase Vouchers
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS purchase_account_id INT DEFAULT NULL`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS payable_account_id INT DEFAULT NULL`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS journal_entry_id INT DEFAULT NULL`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(15,2) NOT NULL DEFAULT 0`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS extra_charges DECIMAL(15,2) NOT NULL DEFAULT 0`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS other_charges DECIMAL(15,2) NOT NULL DEFAULT 0`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS supplier_id INT DEFAULT NULL`,
        // Store Settings
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_cash DECIMAL(5,2) DEFAULT 16`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_card DECIMAL(5,2) DEFAULT 5`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_online DECIMAL(5,2) DEFAULT 5`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS jv_delete_password VARCHAR(255) NULL`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pos_mode VARCHAR(10) DEFAULT 'simple'`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pos_tax_config TEXT NULL`,
        // Printers
        `ALTER TABLE printers ADD COLUMN IF NOT EXISTS printer_type ENUM('invoice','kot') NOT NULL DEFAULT 'invoice'`,
        `ALTER TABLE printers ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        // Stores
        `ALTER TABLE stores ADD COLUMN IF NOT EXISTS monthly_charge DECIMAL(10,2) DEFAULT 0.00`,
        // Sale details
        `ALTER TABLE sale_details ADD COLUMN IF NOT EXISTS profit DECIMAL(10,2) DEFAULT NULL`,
      ];
      for (const sql of stmts) {
        try { await queryDb(db, sql); } catch (e) {
          // Non-fatal: column already exists, or table doesn't exist (was dropped in later migration)
          if (!e.message.includes('Duplicate column') && !e.message.includes("doesn't exist")) throw e;
        }
      }
    },
  },
  {
    version: 2,
    name: 'add_missing_indexes',
    async run(db) {
      const indexes = [
        [`ALTER TABLE sale_details ADD INDEX IF NOT EXISTS idx_sd_sale_id (sale_id)`],
        [`ALTER TABLE sale_details ADD INDEX IF NOT EXISTS idx_sd_product_id (product_id)`],
        [`ALTER TABLE users ADD INDEX IF NOT EXISTS idx_user_username (username)`],
        [`ALTER TABLE users ADD INDEX IF NOT EXISTS idx_user_active (is_active)`],
        // branch_id removed in phase 5 — index skipped
        [`ALTER TABLE customers ADD INDEX IF NOT EXISTS idx_customer_deleted (deleted_at)`],
        [`ALTER TABLE products ADD INDEX IF NOT EXISTS idx_product_active (is_active)`],
        [`ALTER TABLE products ADD INDEX IF NOT EXISTS idx_product_deleted (deleted_at)`],
        [`ALTER TABLE credit_sales ADD INDEX IF NOT EXISTS idx_credit_due_date (due_date)`],
        [`ALTER TABLE audit_logs ADD INDEX IF NOT EXISTS idx_audit_user_date (user_id, created_at)`],
      ];
      for (const [sql] of indexes) {
        try { await queryDb(db, sql); }
        catch (e) {
          if (!e.message.includes('Duplicate key name')) throw e;
        }
      }
    },
  },
  {
    version: 3,
    name: 'token_blacklist_table',
    async run(db) {
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS token_blacklist (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          token_hash  VARCHAR(64)  NOT NULL UNIQUE,
          expires_at  DATETIME     NOT NULL,
          created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_expires (expires_at),
          INDEX idx_hash    (token_hash)
        )
      `);
    },
  },
  {
    version: 4,
    name: 'departments_table',
    async run(_db) { /* HR module removed — no-op */ },
  },
  {
    version: 5,
    name: 'customers_address_column',
    async run(db) {
      await queryDb(db, `ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT NULL`);
    },
  },
  {
    version: 6,
    name: 'waiter_role',
    async run(db) {
      // Add Waiter role and its default permissions
      await queryDb(db, `INSERT IGNORE INTO roles (role_name) VALUES ('Waiter')`);
      const perms = ['sales', 'sales.pos', 'customers'];
      for (const key of perms) {
        await queryDb(db,
          `INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES ('Waiter', ?, 1)`,
          [key]
        );
      }
    },
  },
  {
    version: 7,
    name: 'waiter_crud_permissions',
    async run(db) {
      // Waiter needs CRUD sub-keys because requirePermission('sales.pos') checks
      // 'sales.pos.create' for POST and 'sales.pos.update' for PUT
      const perms = [
        'sales.pos.create',
        'sales.pos.update',
        'customers.create',
      ];
      for (const key of perms) {
        await queryDb(db,
          `INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES ('Waiter', ?, 1)`,
          [key]
        );
      }
    },
  },
  {
    version: 8,
    name: 'ensure_joined_tables',
    async run(db) {
      // These tables are JOIN-ed in sales queries but only created lazily in controllers.
      // Missing tables cause 500 errors on every sales GET request.
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS restaurant_tables (
          table_id   INT PRIMARY KEY AUTO_INCREMENT,
          table_name VARCHAR(50)  NOT NULL,
          floor      VARCHAR(50)  DEFAULT 'Main',
          capacity   INT          DEFAULT 4,
          status     ENUM('available','occupied') DEFAULT 'available',
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS deliveries (
          delivery_id       INT PRIMARY KEY AUTO_INCREMENT,
          delivery_number   VARCHAR(30)  NULL,
          sale_id           INT          NULL,
          customer_id       INT          NULL,
          delivery_address  TEXT         NULL,
          delivery_city     VARCHAR(100) DEFAULT '',
          delivery_phone    VARCHAR(30)  DEFAULT '',
          rider_name        VARCHAR(100) DEFAULT '',
          rider_phone       VARCHAR(30)  DEFAULT '',
          status            VARCHAR(30)  DEFAULT 'pending',
          delivery_charges  DECIMAL(10,2) DEFAULT 0,
          estimated_delivery DATETIME   NULL,
          notes             TEXT         NULL,
          created_by        INT          NULL,
          branch_id         INT          NULL,
          created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
  },
  {
    version: 9,
    name: 'sales_missing_columns',
    async run(db) {
      const stmts = [
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS note TEXT NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5,2) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_charges_percent DECIMAL(5,2) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_charges_amount DECIMAL(10,2) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150) NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30) NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0`,
      ];
      for (const sql of stmts) {
        try { await queryDb(db, sql); } catch (e) {
          if (!e.message.includes('Duplicate column')) throw e;
        }
      }
    },
  },
  {
    version: 10,
    name: 'printer_agent_url',
    async run(db) {
      await queryDb(db, `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS printer_agent_url VARCHAR(255) NULL`);
    },
  },
  {
    version: 11,
    name: 'print_queue_table',
    async run(db) {
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS print_queue (
          id           INT AUTO_INCREMENT PRIMARY KEY,
          type         VARCHAR(50)  NOT NULL DEFAULT 'invoice',
          payload      JSON         NOT NULL,
          status       ENUM('pending','printing','done','failed') DEFAULT 'pending',
          error_message TEXT        NULL,
          created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
          processed_at DATETIME     NULL,
          INDEX idx_pq_status (status),
          INDEX idx_pq_created (created_at)
        )
      `);
    },
  },
  {
    version: 12,
    name: 'agent_token_column',
    async run(db) {
      await queryDb(db, `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS agent_token VARCHAR(100) NULL`);
    },
  },
  {
    version: 13,
    name: 'biometric_attendance_tables',
    async run(_db) { /* HR module removed — no-op */ },
  },
  {
    version: 14,
    name: 'store_inventory_table',
    async run(db) {
      // B-010: store_inventory used in stockTransferController but never created in migrations
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS store_inventory (
          id              INT PRIMARY KEY AUTO_INCREMENT,
          store_id        INT NOT NULL,
          product_id      INT NOT NULL,
          available_stock DECIMAL(10,2) DEFAULT 0,
          updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_store_product (store_id, product_id),
          INDEX idx_si_store (store_id),
          INDEX idx_si_product (product_id)
        )
      `);
    },
  },
  {
    version: 15,
    name: 'ensure_runtime_created_tables',
    async run(db) {
      // B-023: Tables created at runtime in controllers — add to migrations for fresh installs
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS sale_bundles (
          id              INT PRIMARY KEY AUTO_INCREMENT,
          sale_id         INT NOT NULL,
          bundle_id       INT NOT NULL,
          bundle_name     VARCHAR(200) NOT NULL,
          discount_amount DECIMAL(10,2) DEFAULT 0,
          created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_sb_sale (sale_id)
        )
      `);
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS stock_layers (
          layer_id      INT PRIMARY KEY AUTO_INCREMENT,
          product_id    INT NOT NULL,
          pv_id         INT NULL,
          source_type   VARCHAR(50) NOT NULL DEFAULT 'purchase',
          ref_date      DATE NULL,
          qty_original  DECIMAL(10,2) NOT NULL DEFAULT 0,
          qty_remaining DECIMAL(10,2) NOT NULL DEFAULT 0,
          unit_cost     DECIMAL(10,4) NOT NULL DEFAULT 0,
          created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_sl_product (product_id),
          INDEX idx_sl_pv (pv_id)
        )
      `);
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS opening_stock_entries (
          entry_id    INT PRIMARY KEY AUTO_INCREMENT,
          product_id  INT NOT NULL,
          quantity    DECIMAL(10,2) NOT NULL,
          unit_cost   DECIMAL(10,4) DEFAULT 0,
          entry_date  DATE NOT NULL,
          notes       TEXT NULL,
          created_by  INT NULL,
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ose_product (product_id)
        )
      `);
    },
  },
  {
    version: 16,
    name: 'audit_logs_old_new_values',
    async run(db) {
      // auditService.js inserts old_values/new_values — add columns if missing
      await queryDb(db, `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSON NULL`);
      await queryDb(db, `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSON NULL`);
      await queryDb(db, `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name VARCHAR(100) NULL`);
    },
  },
  {
    version: 17,
    name: 'users_password_reset_token',
    async run(db) {
      await queryDb(db, `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64) NULL`);
      await queryDb(db, `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME NULL`);
      await queryDb(db, `ALTER TABLE users ADD INDEX IF NOT EXISTS idx_reset_token (reset_token)`);
    },
  },
  {
    version: 18,
    name: 'performance_indexes',
    async run(db) {
      const idxs = [
        // Sales — hot paths hit on every report and POS lookup
        ['sales',                'idx_sales_branch_date_status', '(branch_id, sale_date, status)'],
        ['sales',                'idx_sales_branch_invoice',     '(branch_id, invoice_no)'],
        ['sales',                'idx_sales_token_no',           '(token_no)'],
        // Sale details — join target for every order fetch
        ['sale_details',         'idx_sd_sale_product',          '(sale_id, product_id)'],
        // Credit payments — lookup by credit_sale_id
        ['credit_payments',      'idx_cp_credit_sale',           '(credit_sale_id)'],
        // Deliveries — join from sales
        ['deliveries',           'idx_deliveries_sale_id',       '(sale_id)'],
        // Cash movements — filtered by shift/register
        ['cash_movements',       'idx_cm_register_created',      '(register_id, created_at)'],
        // Return details — join from returns
        ['return_details',       'idx_rd_return_product',        '(return_id, product_id)'],
        // Stock issue items — join from stock issues
        ['stock_issue_items',    'idx_sii_issue_product',        '(issue_id, product_id)'],
      ];
      for (const [table, idx, cols] of idxs) {
        try {
          await queryDb(db, `ALTER TABLE \`${table}\` ADD INDEX IF NOT EXISTS \`${idx}\` ${cols}`);
        } catch (e) {
          // Table may not exist in all tenant configs; skip gracefully
          if (!e.message?.includes("doesn't exist") && !e.message?.includes('Duplicate key name')) throw e;
        }
      }
    },
  },
  {
    version: 19,
    name: 'runtime_alter_table_cleanup',
    async run(db) {
      // Consolidate all runtime ALTER TABLEs that were scattered across controllers.
      // Running them here at startup (once per tenant) eliminates the overhead of
      // executing schema checks on every API request.
      const stmts = [
        // store_settings — payment-method tax rates
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_cash DECIMAL(5,2) DEFAULT 16`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_card DECIMAL(5,2) DEFAULT 5`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_online DECIMAL(5,2) DEFAULT 5`,
        // store_settings — security passwords
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS jv_delete_password VARCHAR(255) NULL`,
        // store_settings — POS mode
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pos_mode VARCHAR(10) DEFAULT 'simple'`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pos_tax_config TEXT NULL`,
        // store_settings — receipt logo
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS receipt_logo VARCHAR(500) NULL`,
        // store_settings — backup scheduler
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS backup_schedule_enabled TINYINT(1) DEFAULT 1`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS backup_schedule_time VARCHAR(5) DEFAULT '02:00'`,
        // store_settings — FBR integration
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS fbr_enabled TINYINT(1) DEFAULT 0`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS fbr_posid INT NULL`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS fbr_username VARCHAR(100) NULL`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS fbr_password VARCHAR(255) NULL`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS fbr_mode ENUM('sandbox','live') DEFAULT 'sandbox'`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS fbr_ntn VARCHAR(50) NULL`,
        // sales — FBR tracking
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS fbr_invoice_no VARCHAR(100) NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS fbr_status ENUM('not_sent','pending','sent','failed') DEFAULT 'not_sent'`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS fbr_synced_at DATETIME NULL`,
        // printers — extended schema
        `ALTER TABLE printers ADD COLUMN IF NOT EXISTS printer_type ENUM('invoice','kot') NOT NULL DEFAULT 'invoice'`,
        `ALTER TABLE printers ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE printers ADD COLUMN IF NOT EXISTS is_master TINYINT(1) DEFAULT 0`,
        // printer_category_mappings — KOT routing table
        `CREATE TABLE IF NOT EXISTS printer_category_mappings (
           id INT PRIMARY KEY AUTO_INCREMENT,
           printer_id INT NOT NULL,
           category_id INT NOT NULL,
           UNIQUE KEY uq_printer_cat (printer_id, category_id),
           FOREIGN KEY (printer_id) REFERENCES printers(printer_id) ON DELETE CASCADE
         )`,
      ];
      for (const sql of stmts) {
        try {
          await queryDb(db, sql);
        } catch (e) {
          if (!e.message?.includes('Duplicate column') && !e.message?.includes('already exists')) {
            throw e;
          }
        }
      }
    },
  },
  {
    version: 20,
    name: 'sales_covers_column',
    async run(db) {
      await queryDb(db, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS covers SMALLINT UNSIGNED NULL`);
    },
  },
  {
    version: 21,
    name: 'restaurant_tables_cleaning_status',
    async run(db) {
      await queryDb(db, `ALTER TABLE restaurant_tables MODIFY COLUMN status ENUM('available','occupied','needs_cleaning') DEFAULT 'available'`);
    },
  },
  {
    version: 22,
    name: 'phase5_drop_branch_columns_and_store_tables',
    async run(db) {
      // Phase 5: single-tenant offline conversion — remove multi-branch/store remnants.
      // Drop dependent tables first (FK order), then drop branch_id columns.
      const dropTables = [
        `DROP TABLE IF EXISTS stock_transfers`,
        `DROP TABLE IF EXISTS store_inventory`,
      ];
      for (const sql of dropTables) {
        try { await queryDb(db, sql); } catch (e) {
          if (!e.message?.includes("doesn't exist")) throw e;
        }
      }

      const dropColumns = [
        [`sales`,                `branch_id`],
        [`categories`,           `branch_id`],
        [`users`,                `branch_id`],
        [`credit_sales`,         `branch_id`],
        [`deliveries`,           `branch_id`],
        [`stock_issues`,         `branch_id`],
        [`stock_issue_returns`,  `branch_id`],
        [`raw_sales`,            `branch_id`],
        [`purchase_orders`,      `branch_id`],
        [`quotations`,           `branch_id`],
        [`cash_registers`,       `branch_id`],
        [`returns`,              `branch_id`],
        [`inv_purchase_vouchers`,`branch_id`],
        [`printers`,             `branch_id`],
        [`products`,             `branch_id`],
      ];
      for (const [table, col] of dropColumns) {
        try {
          await queryDb(db, `ALTER TABLE \`${table}\` DROP COLUMN IF EXISTS \`${col}\``);
        } catch (e) {
          if (!e.message?.includes("doesn't exist") && !e.message?.includes("check that column/key exists")) throw e;
        }
      }

      // Drop FK from sales.branch_id → stores before dropping stores table
      // (MariaDB may have named it automatically; ignore if not present)
      try {
        const fks = await queryDb(db, `
          SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales'
          AND COLUMN_NAME = 'branch_id' AND REFERENCED_TABLE_NAME = 'stores'
        `);
        for (const { CONSTRAINT_NAME } of fks) {
          await queryDb(db, `ALTER TABLE sales DROP FOREIGN KEY \`${CONSTRAINT_NAME}\``);
        }
      } catch (_e) { /* ignore */ }

      // Also drop FK from stock_adjustments and purchase_orders → stores
      try {
        for (const tbl of ['stock_adjustments', 'purchase_orders']) {
          const fks = await queryDb(db, `
            SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
            AND REFERENCED_TABLE_NAME = 'stores'
          `, [tbl]);
          for (const { CONSTRAINT_NAME } of fks) {
            await queryDb(db, `ALTER TABLE \`${tbl}\` DROP FOREIGN KEY \`${CONSTRAINT_NAME}\``);
          }
        }
      } catch (_e) { /* ignore */ }

      // Now safe to drop stores
      try { await queryDb(db, `DROP TABLE IF EXISTS stores`); } catch (_e) { /* ignore */ }

      // Fix categories unique key: drop old composite key, add simple name key
      try {
        await queryDb(db, `ALTER TABLE categories DROP INDEX unique_category_per_branch`);
      } catch (_e) { /* ignore if already removed */ }
      try {
        await queryDb(db, `ALTER TABLE categories ADD UNIQUE KEY unique_category_name (category_name)`);
      } catch (_e) { /* ignore if already exists */ }
    },
  },
  {
    version: 23,
    name: 'add_actual_delivery_column',
    async run(db) {
      await queryDb(db, `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS actual_delivery DATETIME NULL`);
    },
  },
  {
    version: 24,
    name: 'add_performance_indexes',
    async run(db) {
      const idxs = [
        // sales — most queried table; user_id/customer_id used in joins and filters
        `ALTER TABLE sales ADD INDEX IF NOT EXISTS idx_sale_user (user_id)`,
        `ALTER TABLE sales ADD INDEX IF NOT EXISTS idx_sale_customer (customer_id)`,
        // credit_payments — joined on every credit aging query
        `ALTER TABLE credit_payments ADD INDEX IF NOT EXISTS idx_cp_credit_sale (credit_sale_id)`,
        // stock_issue_items — joined in items ledger and issuance reports
        `ALTER TABLE stock_issue_items ADD INDEX IF NOT EXISTS idx_sii_issue (issue_id)`,
        `ALTER TABLE stock_issue_items ADD INDEX IF NOT EXISTS idx_sii_product (product_id)`,
        // stock_issue_return_items — joined in items ledger
        `ALTER TABLE stock_issue_return_items ADD INDEX IF NOT EXISTS idx_siri_return (return_id)`,
        // raw_sale_items — joined in items ledger
        `ALTER TABLE raw_sale_items ADD INDEX IF NOT EXISTS idx_rsi_sale (sale_id)`,
        // inv_purchase_voucher_items — joined in items ledger and stock reconciliation
        `ALTER TABLE inv_purchase_voucher_items ADD INDEX IF NOT EXISTS idx_pvi_product (product_id)`,
        // purchase_return_items — joined in returns report and items ledger
        `ALTER TABLE purchase_return_items ADD INDEX IF NOT EXISTS idx_pri_product (product_id)`,
        // cash_movements — joined in register close and reconciliation
        `ALTER TABLE cash_movements ADD INDEX IF NOT EXISTS idx_cm_register (register_id)`,
        // print_queue — polled every few seconds
        `ALTER TABLE print_queue ADD INDEX IF NOT EXISTS idx_pq_status (status)`,
      ];
      for (const stmt of idxs) {
        try { await queryDb(db, stmt); } catch (_e) { /* index may already exist */ }
      }
    },
  },
  {
    version: 25,
    name: 'add_missing_fk_constraints_and_indexes',
    async run(db) {
      const exec = async (sql) => {
        try { await queryDb(db, sql); } catch (e) {
          if (!e.message?.includes('Duplicate key name') &&
              !e.message?.includes('already exists') &&
              !e.message?.includes("Can't create table") &&
              !e.message?.includes('errno: 150')) throw e;
        }
      };

      // D1: Add FK for sale_details.variant_id (not present in schema, only an index)
      await exec(`ALTER TABLE sale_details ADD CONSTRAINT fk_sale_details_variant
        FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE SET NULL`);

      // D2: Add FK for stock_adjustments.variant_id
      await exec(`ALTER TABLE stock_adjustments ADD CONSTRAINT fk_stock_adj_variant
        FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE SET NULL`);

      // D4: Add FK for stock_layers.pv_id → inv_purchase_vouchers
      await exec(`ALTER TABLE stock_layers ADD CONSTRAINT fk_stock_layers_pv
        FOREIGN KEY (pv_id) REFERENCES inv_purchase_vouchers(pv_id) ON DELETE SET NULL`);

      // D6: Fix print_queue.payload type — schema has LONGTEXT, migration v11 creates JSON
      // Align the schema column to JSON for consistency and validation
      await exec(`ALTER TABLE print_queue MODIFY COLUMN payload JSON NOT NULL`);

      // D8: Add missing indexes on frequently queried foreign keys
      // (bundle_items already has idx_bundle_items_bundle_id in schema — skip to avoid duplicate)
      await exec(`CREATE INDEX IF NOT EXISTS idx_issue_items_issue_id ON stock_issue_items (issue_id)`);
      await exec(`CREATE INDEX IF NOT EXISTS idx_issue_return_items_return_id ON stock_issue_return_items (return_id)`);
      await exec(`CREATE INDEX IF NOT EXISTS idx_pr_items_pr_id ON purchase_return_items (pr_id)`);
      await exec(`CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items (quotation_id)`);

      // D9: Remove orphaned store_id column left from multi-store removal (migration v22)
      // stock_adjustments still has store_id in schema; inv_purchase_vouchers does not (use IF EXISTS)
      await exec(`ALTER TABLE stock_adjustments DROP COLUMN IF EXISTS store_id`);
      await exec(`ALTER TABLE inv_purchase_vouchers DROP COLUMN IF EXISTS store_id`);

      // D10: Add FK for quotations.converted_sale_id
      await exec(`ALTER TABLE quotations ADD CONSTRAINT fk_quotation_converted_sale
        FOREIGN KEY (converted_sale_id) REFERENCES sales(sale_id) ON DELETE SET NULL`);

      // D12: Make FK for sale_details.product_id explicit with RESTRICT
      // Schema already has this FK, but this is a no-op on existing installs due to exec() swallowing duplicate errors
      await exec(`ALTER TABLE sale_details ADD CONSTRAINT fk_sale_details_product
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT`);
    },
  },
  {
    version: 26,
    name: 'sales_controller_schema_drift',
    // Absorbs all ALTER TABLE statements that were previously executed inline
    // inside salesController.ensureSalesSchema on every API call. Moving them
    // here keeps the architectural rule: schema changes only through migrations.
    async run(db) {
      const exec = async (sql) => {
        try { await queryDb(db, sql); } catch (e) {
          if (!e.message?.includes('Duplicate column name') &&
              !e.message?.includes('already exists')) throw e;
        }
      };
      // Sales columns
      await exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS note TEXT NULL`);
      await exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150) NULL`);
      await exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30) NULL`);
      await exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5,2) DEFAULT 0`);
      await exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0`);
      await exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_charges_percent DECIMAL(5,2) DEFAULT 0`);
      await exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_charges_amount DECIMAL(10,2) DEFAULT 0`);
      await exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0`);
      await exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0`);
      await exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS covers INT NULL`);
      // Sale_details columns
      await exec(`ALTER TABLE sale_details ADD COLUMN IF NOT EXISTS note TEXT NULL`);
      await exec(`ALTER TABLE sale_details ADD COLUMN IF NOT EXISTS variant_name VARCHAR(100) NULL`);
      // Deliveries columns (tables themselves are in schema.sql)
      await exec(`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_charges DECIMAL(10,2) DEFAULT 0`);
      await exec(`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS notes TEXT NULL`);
      await exec(`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_number VARCHAR(30) NULL`);
    },
  },
];

async function ensureMigrationsTable(db) {
  await queryDb(db, `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INT PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedVersions(db) {
  const rows = await queryDb(db, 'SELECT version FROM schema_migrations ORDER BY version');
  return new Set(rows.map(r => r.version));
}

async function runMigrationsForDb(db) {
  try {
    await ensureMigrationsTable(db);
    const applied = await getAppliedVersions(db);

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;

      try {
        await migration.run(db);
        await queryDb(db, 'INSERT IGNORE INTO schema_migrations (version, name) VALUES (?, ?)', [
          migration.version, migration.name,
        ]);
        logger.info(`[Migration] v${migration.version} "${migration.name}" applied`, { db });
      } catch (err) {
        logger.error(`[Migration] v${migration.version} FAILED on ${db}`, { error: err.message });
      }
    }
  } catch (err) {
    logger.warn(`[Migration] Could not run migrations on ${db}`, { error: err.message });
  }
}

module.exports = { runMigrationsForDb };
