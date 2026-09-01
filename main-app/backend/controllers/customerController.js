// =============================================================
// customerController.js - Customer Management Controller
// Handles viewing, creating, and looking up customers.
// Customers can be linked to sales for tracking purchase history.
// Customer ID 1 is "Walk-in Customer" (default for anonymous sales).
// Used by: /api/customers routes
// =============================================================

const logger = require('../config/logger');
const { query, getCurrentDb } = require('../config/database');
const { logAction } = require('../services/auditService');
const addressTableEnsuredPerTenant = new Set();
async function ensureAddressTable() {
  const db = getCurrentDb();
  if (addressTableEnsuredPerTenant.has(db)) return;
  try {
    const rows = await query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_addresses'`
    );
    if (rows.length === 0) {
      await query(`
        CREATE TABLE customer_addresses (
          address_id INT PRIMARY KEY AUTO_INCREMENT,
          customer_id INT NOT NULL,
          address_text TEXT NOT NULL,
          label VARCHAR(50) DEFAULT NULL,
          is_default TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
          INDEX idx_customer_address (customer_id)
        )
      `);
    }
    addressTableEnsuredPerTenant.add(db);
  } catch (err) {
    logger.error('ensureAddressTable error', { error: err.message });
  }
}

// Helper: Validate and parse pagination params
const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 per page
  return {
    page: Math.max(1, pageNum),
    limit: Math.max(1, limitNum),
    offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum)
  };
};

// --- Get All Customers ---
// Returns all customers, optionally filtered by search keyword.
// Search matches against customer name or phone number.
// Used on the Customers page and in the POS customer dropdown.
exports.getAll = async (req, res) => {
  try {
    await ensureAddressTable();
    const { search } = req.query;  // Optional search keyword from URL ?search=...
    // JOIN with customer_addresses to get default address (fallback for older records)
    let sql = `SELECT c.*, ca.address_text AS default_address
               FROM customers c
               LEFT JOIN customer_addresses ca ON ca.customer_id = c.customer_id AND ca.is_default = 1`;
    const params = [];

    // If a search keyword is provided, filter by name or phone (partial match)
    if (search) {
      sql += ' WHERE c.customer_name LIKE ? OR c.phone_number LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Pagination
    const { page, limit } = req.query;
    if (page && limit) {
      const pg = parsePagination(page, limit);

      const countSql = 'SELECT COUNT(*) as total FROM customers' + (search ? ' WHERE customer_name LIKE ? OR phone_number LIKE ?' : '');
      const countParams = search ? [`%${search}%`, `%${search}%`] : [];
      const countResult = await query(countSql, countParams);
      const total = Number(countResult[0].total);

      sql += ' ORDER BY c.customer_name LIMIT ? OFFSET ?';
      params.push(pg.limit, pg.offset);

      const rows = await query(sql, params);
      return res.json({
          data: rows,
          pagination: { total, page: pg.page, limit: pg.limit, totalPages: Math.ceil(total / pg.limit) }
      });
    }

    sql += ' ORDER BY c.customer_name LIMIT 50';
    const rows = await query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    logger.error('getAll customers error', { message: err.message, code: err.code, sql: err.sql });
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// --- Create New Customer ---
// Adds a new customer record. Name is required, other fields optional.
// The new customer can then be selected when making a sale.
exports.create = async (req, res) => {
  try {
    const { customer_name, phone_number, email, company, tax_id, address } = req.body;

    if (!customer_name) return res.status(400).json({ message: 'Customer name is required' });

    // Normalize empty values to null
    const phone = phone_number && phone_number.trim() ? phone_number.trim() : null;
    const emailVal = email && email.trim() ? email.trim() : null;
    const companyVal = company && company.trim() ? company.trim() : null;
    const taxIdVal = tax_id && tax_id.trim() ? tax_id.trim() : null;

    const addrVal = address && address.trim() ? address.trim() : null;

    const result = await query(
      'INSERT INTO customers (customer_name, phone_number, email, company, tax_id, address) VALUES (?, ?, ?, ?, ?, ?)',
      [customer_name, phone, emailVal, companyVal, taxIdVal, addrVal]
    );

    const customerId = Number(result.insertId);

    // Also save address to customer_addresses for multi-address support
    if (addrVal) {
      await query(
        'INSERT INTO customer_addresses (customer_id, address_text, is_default) VALUES (?, ?, 1)',
        [customerId, addrVal]
      );
    }

    // Return full customer object for auto-selection in POS
    const newCustomer = await query('SELECT * FROM customers WHERE customer_id = ?', [customerId]);

    await logAction(
      req.user?.user_id, req.user?.name || req.user?.username,
      'CUSTOMER_CREATED', 'customer', customerId,
      { customer_name, phone: phone, email: emailVal },
      req.ip
    );

    res.status(201).json({ message: 'Customer created', customer_id: customerId, customer: newCustomer[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Phone number already exists for another customer' });
    }
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get Customer By ID (with Purchase History) ---
// Returns a single customer's details along with their purchase history.
// Purchase history shows all sales linked to this customer (date, amount, cashier).
// Used when clicking on a customer to view their details.
exports.getById = async (req, res) => {
  try {
    // Fetch the customer record (with default address fallback from customer_addresses)
    const rows = await query(
      `SELECT c.customer_id, c.customer_name, c.phone_number, c.email, c.company, c.tax_id, c.created_at,
              ca.address_text AS address
       FROM customers c
       LEFT JOIN customer_addresses ca ON ca.customer_id = c.customer_id AND ca.is_default = 1
       WHERE c.customer_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });

    // Pagination for purchases
    const { page, limit } = req.query;

    if (page && limit) {
      const pg = parsePagination(page, limit);

      // Count total purchases
      const countResult = await query(
        'SELECT COUNT(*) as total FROM sales WHERE customer_id = ?',
        [req.params.id]
      );
      const total = Number(countResult[0].total);

      // Fetch paginated purchases
      const purchases = await query(
        `SELECT s.sale_id, s.sale_date, s.net_amount, u.name as cashier_name
         FROM sales s LEFT JOIN users u ON s.user_id = u.user_id
         WHERE s.customer_id = ? ORDER BY s.sale_date DESC LIMIT ? OFFSET ?`,
        [req.params.id, pg.limit, pg.offset]
      );

      return res.json({
        ...rows[0],
        purchases,
        pagination: {
          total,
          page: pg.page,
          limit: pg.limit,
          totalPages: Math.ceil(total / pg.limit)
        }
      });
    }

    // Fetch all sales made to this customer (with cashier name)
    const purchases = await query(
      `SELECT s.sale_id, s.sale_date, s.net_amount, u.name as cashier_name
       FROM sales s LEFT JOIN users u ON s.user_id = u.user_id
       WHERE s.customer_id = ? ORDER BY s.sale_date DESC`,
      [req.params.id]
    );

    // Return customer data with purchases array attached
    res.json({ ...rows[0], purchases });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Customer ---
// Updates an existing customer's details.
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, phone_number, email, company, tax_id, address } = req.body;

    if (!customer_name) return res.status(400).json({ message: 'Customer name is required' });

    const phone = phone_number && phone_number.trim() ? phone_number.trim() : null;
    const emailVal = email && email.trim() ? email.trim() : null;
    const companyVal = company && company.trim() ? company.trim() : null;
    const taxIdVal = tax_id && tax_id.trim() ? tax_id.trim() : null;

    const addrVal = address && address.trim() ? address.trim() : null;

    await query(
      'UPDATE customers SET customer_name = ?, phone_number = ?, email = ?, company = ?, tax_id = ?, address = ? WHERE customer_id = ?',
      [customer_name, phone, emailVal, companyVal, taxIdVal, addrVal, id]
    );

    // Also upsert in customer_addresses for multi-address support
    if (addrVal) {
      const existing = await query(
        'SELECT address_id FROM customer_addresses WHERE customer_id = ? AND is_default = 1',
        [id]
      );
      if (existing.length > 0) {
        await query('UPDATE customer_addresses SET address_text = ? WHERE address_id = ?', [addrVal, existing[0].address_id]);
      } else {
        await query('INSERT INTO customer_addresses (customer_id, address_text, is_default) VALUES (?, ?, 1)', [id, addrVal]);
      }
    }

    // Return updated customer
    const updatedCustomer = await query('SELECT * FROM customers WHERE customer_id = ?', [id]);

    await logAction(
      req.user?.user_id, req.user?.name || req.user?.username,
      'CUSTOMER_UPDATED', 'customer', id,
      { customer_name },
      req.ip
    );

    res.json({ message: 'Customer updated', customer: updatedCustomer[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Phone number already exists for another customer' });
    }
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Delete Customer ---
// Deletes a customer.
// SAFETY CHECK: Cannot delete "Walk-in Customer" (ID 1) or customers with sales history.
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (id == 1) {
      return res.status(400).json({ message: 'Cannot delete default Walk-in Customer' });
    }

    // Check for sales history
    const sales = await query('SELECT sale_id FROM sales WHERE customer_id = ? LIMIT 1', [id]);
    if (sales.length > 0) {
      return res.status(400).json({ message: 'Cannot delete customer with purchase history' });
    }

    const [deletedCustomer] = await query('SELECT customer_name FROM customers WHERE customer_id = ?', [id]);
    await query('DELETE FROM customers WHERE customer_id = ?', [id]);

    await logAction(
      req.user?.user_id, req.user?.name || req.user?.username,
      'CUSTOMER_DELETED', 'customer', id,
      { customer_name: deletedCustomer?.customer_name },
      req.ip
    );

    res.json({ message: 'Customer deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get Customer Addresses ---
exports.getAddresses = async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC',
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Add Customer Address ---
exports.addAddress = async (req, res) => {
  try {
    const { address_text, label } = req.body;
    if (!address_text || !address_text.trim()) return res.status(400).json({ message: 'Address is required' });

    const result = await query(
      'INSERT INTO customer_addresses (customer_id, address_text, label) VALUES (?, ?, ?)',
      [req.params.id, address_text.trim(), label || 'Default']
    );
    res.status(201).json({ address_id: Number(result.insertId), message: 'Address added' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
