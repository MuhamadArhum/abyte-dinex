// =============================================================
// bundleController.js - Product Bundle Controller
// Manages combo product bundles with automatic discount detection
// at checkout.
// Used by: /api/bundles routes
// =============================================================

const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const auditService = require('../services/auditService');

// Helper function for currency precision
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// ==================== Bundle CRUD Operations ====================

// Get all bundles
exports.getAllBundles = async (req, res) => {
  try {
    const { active_only } = req.query;

    let sql = 'SELECT * FROM product_bundles ORDER BY created_at DESC';
    if (active_only === 'true') {
      sql = 'SELECT * FROM product_bundles WHERE is_active = 1 ORDER BY created_at DESC';
    }

    const bundles = await query(sql);

    // Get items for each bundle
    for (let bundle of bundles) {
      const items = await query(
        `SELECT bi.*, p.product_name, p.price, pv.variant_name, pv.price_adjustment
         FROM bundle_items bi
         JOIN products p ON bi.product_id = p.product_id
         LEFT JOIN product_variants pv ON bi.variant_id = pv.variant_id
         WHERE bi.bundle_id = ?`,
        [bundle.bundle_id]
      );
      bundle.items = items;
    }

    res.json(bundles);
  } catch (err) {
    logger.error('Get bundles error:', err);
    res.status(500).json({ message: 'Failed to fetch bundles', error: err.message });
  }
};

// Get single bundle by ID
exports.getBundleById = async (req, res) => {
  try {
    const { bundle_id } = req.params;

    const bundles = await query(
      'SELECT * FROM product_bundles WHERE bundle_id = ?',
      [bundle_id]
    );

    if (bundles.length === 0) {
      return res.status(404).json({ message: 'Bundle not found' });
    }

    const bundle = bundles[0];

    // Get bundle items
    const items = await query(
      `SELECT bi.*, p.product_name, p.price, pv.variant_name, pv.price_adjustment
       FROM bundle_items bi
       JOIN products p ON bi.product_id = p.product_id
       LEFT JOIN product_variants pv ON bi.variant_id = pv.variant_id
       WHERE bi.bundle_id = ?`,
      [bundle_id]
    );

    bundle.items = items;

    res.json(bundle);
  } catch (err) {
    logger.error('Get bundle by ID error:', err);
    res.status(500).json({ message: 'Failed to fetch bundle', error: err.message });
  }
};

// Create bundle
exports.createBundle = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const {
      bundle_name,
      description,
      discount_type,
      discount_value,
      start_date,
      end_date,
      items // Array of { product_id, variant_id, quantity_required }
    } = req.body;

    // Validation
    if (!bundle_name || !discount_type || !discount_value || !items || items.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        message: 'Bundle name, discount type, discount value, and items are required'
      });
    }

    if (discount_value <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Discount value must be greater than 0' });
    }

    // Create bundle
    const result = await conn.query(
      `INSERT INTO product_bundles
       (bundle_name, description, discount_type, discount_value, start_date, end_date, created_by, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [bundle_name, description || null, discount_type, discount_value, start_date || null, end_date || null, req.user.user_id]
    );

    const bundle_id = result.insertId;

    // Add bundle items
    for (let item of items) {
      if (!item.product_id || !item.quantity_required || item.quantity_required <= 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Each item must have product_id and quantity_required > 0' });
      }

      await conn.query(
        'INSERT INTO bundle_items (bundle_id, product_id, variant_id, quantity_required) VALUES (?, ?, ?, ?)',
        [bundle_id, item.product_id, item.variant_id || null, item.quantity_required]
      );
    }

    await conn.commit();

    await auditService.logAction(
      req.user.user_id,
      req.user.username,
      'CREATE',
      'product_bundle',
      bundle_id,
      { bundle_name, discount_type, discount_value },
      req.ip
    );

    res.status(201).json({
      message: 'Bundle created successfully',
      bundle_id
    });
  } catch (err) {
    await conn.rollback();
    logger.error('Create bundle error:', err);
    res.status(500).json({ message: 'Failed to create bundle', error: err.message });
  } finally {
    conn.release();
  }
};

// Update bundle
exports.updateBundle = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { bundle_id } = req.params;
    const {
      bundle_name,
      description,
      discount_type,
      discount_value,
      is_active,
      start_date,
      end_date,
      items
    } = req.body;

    // Check if bundle exists
    const existing = await conn.query(
      'SELECT * FROM product_bundles WHERE bundle_id = ?',
      [bundle_id]
    );

    if (!existing || existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Bundle not found' });
    }

    // Update bundle
    const updates = [];
    const values = [];

    if (bundle_name) {
      updates.push('bundle_name = ?');
      values.push(bundle_name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (discount_type) {
      updates.push('discount_type = ?');
      values.push(discount_type);
    }
    if (discount_value !== undefined) {
      if (discount_value <= 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Discount value must be greater than 0' });
      }
      updates.push('discount_value = ?');
      values.push(discount_value);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(end_date);
    }

    if (updates.length > 0) {
      values.push(bundle_id);
      await conn.query(
        `UPDATE product_bundles SET ${updates.join(', ')} WHERE bundle_id = ?`,
        values
      );
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      // Delete existing items
      await conn.query('DELETE FROM bundle_items WHERE bundle_id = ?', [bundle_id]);

      // Insert new items
      for (let item of items) {
        if (!item.product_id || !item.quantity_required || item.quantity_required <= 0) {
          await conn.rollback();
          return res.status(400).json({ message: 'Each item must have product_id and quantity_required > 0' });
        }

        await conn.query(
          'INSERT INTO bundle_items (bundle_id, product_id, variant_id, quantity_required) VALUES (?, ?, ?, ?)',
          [bundle_id, item.product_id, item.variant_id || null, item.quantity_required]
        );
      }
    }

    await conn.commit();

    await auditService.logAction(
      req.user.user_id,
      req.user.username,
      'UPDATE',
      'product_bundle',
      bundle_id,
      req.body,
      req.ip
    );

    res.json({ message: 'Bundle updated successfully' });
  } catch (err) {
    await conn.rollback();
    logger.error('Update bundle error:', err);
    res.status(500).json({ message: 'Failed to update bundle', error: err.message });
  } finally {
    conn.release();
  }
};

// Delete bundle
exports.deleteBundle = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { bundle_id } = req.params;

    // Check if bundle exists
    const existing = await conn.query(
      'SELECT * FROM product_bundles WHERE bundle_id = ?',
      [bundle_id]
    );

    if (!existing || existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Bundle not found' });
    }

    // Check if bundle is used in any sales
    const usedInSales = await conn.query(
      'SELECT COUNT(*) as count FROM sale_bundles WHERE bundle_id = ?',
      [bundle_id]
    );

    if (usedInSales && usedInSales.length > 0 && usedInSales[0].count > 0) {
      await conn.rollback();
      return res.status(400).json({
        message: 'Cannot delete bundle that has been used in sales. Consider deactivating it instead.'
      });
    }

    // Delete bundle (cascades to bundle_items)
    await conn.query('DELETE FROM product_bundles WHERE bundle_id = ?', [bundle_id]);

    await conn.commit();

    await auditService.logAction(
      req.user.user_id,
      req.user.username,
      'DELETE',
      'product_bundle',
      bundle_id,
      existing[0],
      req.ip
    );

    res.json({ message: 'Bundle deleted successfully' });
  } catch (err) {
    await conn.rollback();
    logger.error('Delete bundle error:', err);
    res.status(500).json({ message: 'Failed to delete bundle', error: err.message });
  } finally {
    conn.release();
  }
};

// ==================== Bundle Detection Algorithm ====================

exports.detectBundles = async (req, res) => {
  try {
    const { cart_items } = req.body;

    if (!cart_items || !Array.isArray(cart_items) || cart_items.length === 0) {
      return res.json({ applicable_bundles: [] });
    }

    // Get all active bundles with valid date range
    const today = new Date().toISOString().split('T')[0];
    const activeBundles = await query(
      `SELECT * FROM product_bundles
       WHERE is_active = 1
       AND (start_date IS NULL OR start_date <= ?)
       AND (end_date IS NULL OR end_date >= ?)
       ORDER BY discount_value DESC`,
      [today, today]
    );

    if (activeBundles.length === 0) {
      return res.json({ applicable_bundles: [] });
    }

    const applicableBundles = [];

    // Check each bundle
    for (let bundle of activeBundles) {
      // Get required items for this bundle
      const requiredItems = await query(
        'SELECT * FROM bundle_items WHERE bundle_id = ?',
        [bundle.bundle_id]
      );

      // Check if cart satisfies all bundle requirements
      let bundleApplies = true;
      for (let required of requiredItems) {
        // Find matching item(s) in cart
        const cartMatches = cart_items.filter(cartItem => {
          const productMatch = cartItem.product_id === required.product_id;
          const variantMatch = required.variant_id
            ? cartItem.variant_id === required.variant_id
            : true; // If bundle doesn't specify variant, any variant works

          return productMatch && variantMatch;
        });

        // Check if we have enough quantity
        const totalQuantityInCart = cartMatches.reduce((sum, item) => sum + item.quantity, 0);
        if (totalQuantityInCart < required.quantity_required) {
          bundleApplies = false;
          break;
        }
      }

      if (bundleApplies) {
        // Calculate discount
        let discountAmount = 0;
        const cartSubtotal = cart_items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

        if (bundle.discount_type === 'percentage') {
          discountAmount = round2((cartSubtotal * bundle.discount_value) / 100);
        } else if (bundle.discount_type === 'fixed_amount') {
          discountAmount = round2(bundle.discount_value);
        } else if (bundle.discount_type === 'fixed_price') {
          // Fixed price means the entire bundle costs this amount
          discountAmount = round2(Math.max(0, cartSubtotal - bundle.discount_value));
        }

        // Ensure discount doesn't exceed subtotal
        discountAmount = Math.min(discountAmount, cartSubtotal);

        applicableBundles.push({
          bundle_id: bundle.bundle_id,
          bundle_name: bundle.bundle_name,
          description: bundle.description,
          discount_type: bundle.discount_type,
          discount_value: bundle.discount_value,
          discount_amount: discountAmount,
          savings: discountAmount
        });
      }
    }

    res.json({ applicable_bundles: applicableBundles });
  } catch (err) {
    logger.error('Detect bundles error:', err);
    res.status(500).json({ message: 'Failed to detect bundles', error: err.message });
  }
};
