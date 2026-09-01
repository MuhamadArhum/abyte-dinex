// =============================================================
// validate.js - Centralized Input Validation Middleware
// Uses express-validator. Import rules from here and attach to routes.
// Usage:
//   const { validateLogin, handleValidation } = require('../middleware/validate');
//   router.post('/login', validateLogin, handleValidation, controller.login);
// =============================================================

const { body, param, query, validationResult } = require('express-validator');

// Send 400 with all validation errors if any
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Auth ────────────────────────────────────────────────────
const validateLogin = [
  body('email').trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .isLength({ max: 255 }),
  body('password').notEmpty().withMessage('Password is required')
    .isLength({ min: 1, max: 128 }).withMessage('Password must be under 128 characters'),
];

// ── User Management ─────────────────────────────────────────
const validateCreateUser = [
  body('username').trim().notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username: only letters, numbers, underscores'),
  body('email').trim().notEmpty().isEmail().withMessage('Valid email required')
    .isLength({ max: 255 }),
  body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters'),
  body('role_name').trim().notEmpty().withMessage('Role is required')
    .isIn(['Admin', 'Manager', 'Cashier', 'Staff']).withMessage('Invalid role'),
  body('branch_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid branch ID'),
];

// ── Products ────────────────────────────────────────────────
const validateProductId = [
  param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
];

// ── Sales ───────────────────────────────────────────────────
const validateSaleId = [
  param('id').isInt({ min: 1 }).withMessage('Invalid sale ID'),
];

const validateCreateSale = [
  body('items').isArray({ min: 1 }).withMessage('Sale must have at least one item'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('Invalid product ID in items'),
  body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be positive'),
  body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Unit price must be non-negative'),
  body('payment_method').trim().notEmpty().withMessage('Payment method is required')
    .isIn(['cash', 'card', 'credit', 'bank_transfer', 'cheque', 'other'])
    .withMessage('Invalid payment method'),
  body('customer_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid customer ID'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be non-negative'),
];

// ── Customers ───────────────────────────────────────────────
const validateCreateCustomer = [
  body('customer_name').trim().notEmpty().withMessage('Customer name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone too long'),
  body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Invalid email')
    .isLength({ max: 255 }),
  body('credit_limit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be non-negative'),
];

// ── Generic ID param ────────────────────────────────────────
const validateId = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ID'),
];

// ── Pagination query params ──────────────────────────────────
const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1-500'),
];

// ── Backup filename ─────────────────────────────────────────
const validateBackupFilename = [
  body('filename').trim().notEmpty().withMessage('Filename required')
    .matches(/^[\w\-]+\.sql$/).withMessage('Invalid backup filename'),
];

module.exports = {
  handleValidation,
  validateLogin,
  validateCreateUser,
  validateProductId,
  validateSaleId,
  validateCreateSale,
  validateCreateCustomer,
  validateId,
  validatePagination,
  validateBackupFilename,
};
