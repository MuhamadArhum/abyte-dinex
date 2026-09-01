const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const auditService = require('../services/auditService');

// Helper function for currency precision
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// ==================== Variant Types ====================

// Get all variant types
exports.getVariantTypes = async (req, res) => {
  try {
    const types = await query('SELECT * FROM variant_types ORDER BY variant_name');
    res.json(types);
  } catch (err) {
    logger.error('Get variant types error:', err);
    res.status(500).json({ message: 'Failed to fetch variant types', error: err.message });
  }
};

// Create variant type
exports.createVariantType = async (req, res) => {
  try {
    const { variant_name } = req.body;

    if (!variant_name) {
      return res.status(400).json({ message: 'Variant name is required' });
    }

    const result = await query(
      'INSERT INTO variant_types (variant_name) VALUES (?)',
      [variant_name]
    );

    await auditService.logAction(
      req.user.user_id,
      req.user.username,
      'CREATE',
      'variant_type',
      result.insertId,
      { variant_name },
      req.ip
    );

    res.status(201).json({
      message: 'Variant type created successfully',
      variant_type_id: result.insertId
    });
  } catch (err) {
    logger.error('Create variant type error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Variant type already exists' });
    }
    res.status(500).json({ message: 'Failed to create variant type', error: err.message });
  }
};

// ==================== Variant Values ====================

// Get all values for a variant type
exports.getVariantValues = async (req, res) => {
  try {
    const { variant_type_id } = req.params;

    const values = await query(
      `SELECT vv.*, vt.variant_name as type_name
       FROM variant_values vv
       JOIN variant_types vt ON vv.variant_type_id = vt.variant_type_id
       WHERE vv.variant_type_id = ?
       ORDER BY vv.value_name`,
      [variant_type_id]
    );

    res.json(values);
  } catch (err) {
    logger.error('Get variant values error:', err);
    res.status(500).json({ message: 'Failed to fetch variant values', error: err.message });
  }
};

// Create variant value
exports.createVariantValue = async (req, res) => {
  try {
    const { variant_type_id, value_name } = req.body;

    if (!variant_type_id || !value_name) {
      return res.status(400).json({ message: 'Variant type ID and value name are required' });
    }

    const result = await query(
      'INSERT INTO variant_values (variant_type_id, value_name) VALUES (?, ?)',
      [variant_type_id, value_name]
    );

    await auditService.logAction(
      req.user.user_id,
      req.user.username,
      'CREATE',
      'variant_value',
      result.insertId,
      { variant_type_id, value_name },
      req.ip
    );

    res.status(201).json({
      message: 'Variant value created successfully',
      variant_value_id: result.insertId
    });
  } catch (err) {
    logger.error('Create variant value error:', err);
    res.status(500).json({ message: 'Failed to create variant value', error: err.message });
  }
};

// ==================== Product Variants ====================

// Get all variants for a product
exports.getProductVariants = async (req, res) => {
  try {
    const { product_id } = req.params;

    // Get product variants
    const variants = await query(
      `SELECT pv.*, vi.available_stock
       FROM product_variants pv
       LEFT JOIN variant_inventory vi ON pv.variant_id = vi.variant_id
       WHERE pv.product_id = ?
       ORDER BY pv.variant_name`,
      [product_id]
    );

    // Get combinations for each variant
    for (let variant of variants) {
      const combinations = await query(
        `SELECT vc.*, vv.value_name, vt.variant_name as type_name
         FROM variant_combinations vc
         JOIN variant_values vv ON vc.variant_value_id = vv.variant_value_id
         JOIN variant_types vt ON vv.variant_type_id = vt.variant_type_id
         WHERE vc.variant_id = ?`,
        [variant.variant_id]
      );
      variant.combinations = combinations;
    }

    res.json(variants);
  } catch (err) {
    logger.error('Get product variants error:', err);
    res.status(500).json({ message: 'Failed to fetch product variants', error: err.message });
  }
};

// Get single variant by ID
exports.getVariantById = async (req, res) => {
  try {
    const { variant_id } = req.params;

    const variants = await query(
      `SELECT pv.*, vi.available_stock, p.product_name, p.price as base_price
       FROM product_variants pv
       LEFT JOIN variant_inventory vi ON pv.variant_id = vi.variant_id
       JOIN products p ON pv.product_id = p.product_id
       WHERE pv.variant_id = ?`,
      [variant_id]
    );

    if (variants.length === 0) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    const variant = variants[0];

    // Get combinations
    const combinations = await query(
      `SELECT vc.*, vv.value_name, vt.variant_name as type_name
       FROM variant_combinations vc
       JOIN variant_values vv ON vc.variant_value_id = vv.variant_value_id
       JOIN variant_types vt ON vv.variant_type_id = vt.variant_type_id
       WHERE vc.variant_id = ?`,
      [variant_id]
    );

    variant.combinations = combinations;
    variant.final_price = round2(parseFloat(variant.base_price) + parseFloat(variant.price_adjustment));

    res.json(variant);
  } catch (err) {
    logger.error('Get variant by ID error:', err);
    res.status(500).json({ message: 'Failed to fetch variant', error: err.message });
  }
};

// Create product variant
exports.createProductVariant = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const {
      product_id,
      sku,
      variant_name,
      price_adjustment,
      stock_quantity,
      barcode,
      combinations // Array of variant_value_ids
    } = req.body;

    // Validation
    if (!product_id || !sku || !variant_name) {
      await conn.rollback();
      return res.status(400).json({ message: 'Product ID, SKU, and variant name are required' });
    }

    // Check if SKU already exists
    const existingSku = await conn.query(
      'SELECT variant_id FROM product_variants WHERE sku = ?',
      [sku]
    );
    if (existingSku && existingSku.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'SKU already exists' });
    }

    // Create variant
    const result = await conn.query(
      `INSERT INTO product_variants
       (product_id, sku, variant_name, price_adjustment, stock_quantity, barcode, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [product_id, sku, variant_name, price_adjustment || 0, stock_quantity || 0, barcode || null]
    );

    const variant_id = result.insertId;

    // Create variant inventory
    await conn.query(
      'INSERT INTO variant_inventory (variant_id, available_stock) VALUES (?, ?)',
      [variant_id, stock_quantity || 0]
    );

    // Create variant combinations
    if (combinations && Array.isArray(combinations) && combinations.length > 0) {
      for (let variant_value_id of combinations) {
        await conn.query(
          'INSERT INTO variant_combinations (variant_id, variant_value_id) VALUES (?, ?)',
          [variant_id, variant_value_id]
        );
      }
    }

    // Update product to indicate it has variants
    await conn.query(
      'UPDATE products SET has_variants = 1 WHERE product_id = ?',
      [product_id]
    );

    await conn.commit();

    await auditService.logAction(
      req.user.user_id,
      req.user.username,
      'CREATE',
      'product_variant',
      variant_id,
      { product_id, sku, variant_name, price_adjustment, stock_quantity },
      req.ip
    );

    res.status(201).json({
      message: 'Product variant created successfully',
      variant_id
    });
  } catch (err) {
    await conn.rollback();
    logger.error('Create product variant error:', err);
    res.status(500).json({ message: 'Failed to create product variant', error: err.message });
  } finally {
    conn.release();
  }
};

// Update product variant
exports.updateProductVariant = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { variant_id } = req.params;
    const {
      sku,
      variant_name,
      price_adjustment,
      stock_quantity,
      barcode,
      is_active,
      combinations
    } = req.body;

    // Check if variant exists
    const existing = await conn.query(
      'SELECT * FROM product_variants WHERE variant_id = ?',
      [variant_id]
    );
    if (!existing || existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Variant not found' });
    }

    // Check SKU uniqueness
    if (sku) {
      const existingSku = await conn.query(
        'SELECT variant_id FROM product_variants WHERE sku = ? AND variant_id != ?',
        [sku, variant_id]
      );
      if (existingSku && existingSku.length > 0) {
        await conn.rollback();
        return res.status(409).json({ message: 'SKU already exists' });
      }
    }

    // Update variant
    const updates = [];
    const values = [];

    if (sku) {
      updates.push('sku = ?');
      values.push(sku);
    }
    if (variant_name) {
      updates.push('variant_name = ?');
      values.push(variant_name);
    }
    if (price_adjustment !== undefined) {
      updates.push('price_adjustment = ?');
      values.push(price_adjustment);
    }
    if (stock_quantity !== undefined) {
      updates.push('stock_quantity = ?');
      values.push(stock_quantity);

      // Update inventory
      await conn.query(
        'UPDATE variant_inventory SET available_stock = ? WHERE variant_id = ?',
        [stock_quantity, variant_id]
      );
    }
    if (barcode !== undefined) {
      updates.push('barcode = ?');
      values.push(barcode);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(variant_id);
      await conn.query(
        `UPDATE product_variants SET ${updates.join(', ')} WHERE variant_id = ?`,
        values
      );
    }

    // Update combinations if provided
    if (combinations && Array.isArray(combinations)) {
      // Delete existing combinations
      await conn.query(
        'DELETE FROM variant_combinations WHERE variant_id = ?',
        [variant_id]
      );

      // Insert new combinations
      for (let variant_value_id of combinations) {
        await conn.query(
          'INSERT INTO variant_combinations (variant_id, variant_value_id) VALUES (?, ?)',
          [variant_id, variant_value_id]
        );
      }
    }

    await conn.commit();

    await auditService.logAction(
      req.user.user_id,
      req.user.username,
      'UPDATE',
      'product_variant',
      variant_id,
      req.body,
      req.ip
    );

    res.json({ message: 'Product variant updated successfully' });
  } catch (err) {
    await conn.rollback();
    logger.error('Update product variant error:', err);
    res.status(500).json({ message: 'Failed to update product variant', error: err.message });
  } finally {
    conn.release();
  }
};

// Delete product variant
exports.deleteProductVariant = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { variant_id } = req.params;

    // Check if variant exists
    const existing = await conn.query(
      'SELECT * FROM product_variants WHERE variant_id = ?',
      [variant_id]
    );
    if (!existing || existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Variant not found' });
    }

    const product_id = existing[0].product_id;

    // Check if variant is used in sales
    const usedInSales = await conn.query(
      'SELECT COUNT(*) as count FROM sale_details WHERE variant_id = ?',
      [variant_id]
    );
    if (usedInSales && usedInSales.length > 0 && usedInSales[0].count > 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Cannot delete variant that has been used in sales' });
    }

    // Delete variant (cascades to combinations and inventory)
    await conn.query('DELETE FROM product_variants WHERE variant_id = ?', [variant_id]);

    // Check if product still has other variants
    const remainingVariants = await conn.query(
      'SELECT COUNT(*) as count FROM product_variants WHERE product_id = ?',
      [product_id]
    );
    if (remainingVariants && remainingVariants.length > 0 && remainingVariants[0].count === 0) {
      // No more variants, update product
      await conn.query(
        'UPDATE products SET has_variants = 0 WHERE product_id = ?',
        [product_id]
      );
    }

    await conn.commit();

    await auditService.logAction(
      req.user.user_id,
      req.user.username,
      'DELETE',
      'product_variant',
      variant_id,
      existing[0],
      req.ip
    );

    res.json({ message: 'Product variant deleted successfully' });
  } catch (err) {
    await conn.rollback();
    logger.error('Delete product variant error:', err);
    res.status(500).json({ message: 'Failed to delete product variant', error: err.message });
  } finally {
    conn.release();
  }
};

// Adjust variant stock
exports.adjustVariantStock = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { variant_id } = req.params;
    const { adjustment, reason } = req.body;

    if (adjustment === undefined || adjustment === null) {
      await conn.rollback();
      return res.status(400).json({ message: 'Adjustment amount is required' });
    }

    const adjustmentNum = parseInt(adjustment);
    if (isNaN(adjustmentNum)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Invalid adjustment amount' });
    }

    // Get current stock
    const inventory = await conn.query(
      'SELECT * FROM variant_inventory WHERE variant_id = ?',
      [variant_id]
    );
    if (!inventory || inventory.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Variant inventory not found' });
    }

    const currentStock = inventory[0].available_stock;
    const newStock = currentStock + adjustmentNum;

    if (newStock < 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Stock cannot be negative' });
    }

    // Update inventory
    await conn.query(
      'UPDATE variant_inventory SET available_stock = ? WHERE variant_id = ?',
      [newStock, variant_id]
    );

    // Update stock_quantity in product_variants
    await conn.query(
      'UPDATE product_variants SET stock_quantity = ? WHERE variant_id = ?',
      [newStock, variant_id]
    );

    await conn.commit();

    await auditService.logAction(
      req.user.user_id,
      req.user.username,
      'STOCK_ADJUSTMENT',
      'variant_inventory',
      variant_id,
      { adjustment: adjustmentNum, old_stock: currentStock, new_stock: newStock, reason },
      req.ip
    );

    res.json({
      message: 'Variant stock adjusted successfully',
      old_stock: currentStock,
      new_stock: newStock
    });
  } catch (err) {
    await conn.rollback();
    logger.error('Adjust variant stock error:', err);
    res.status(500).json({ message: 'Failed to adjust variant stock', error: err.message });
  } finally {
    conn.release();
  }
};
