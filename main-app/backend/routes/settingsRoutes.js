const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get Settings: Accessible by everyone (POS needs it for receipts)
router.get('/', settingsController.getSettings);

// Update Settings: Accessible only by Admin
router.put('/', authorize('Admin'), settingsController.updateSettings);

// Change own password: Any authenticated user
router.post('/change-password', settingsController.changePassword);

// Verify POS security password (server-side bcrypt comparison)
router.post('/verify-password', settingsController.verifyPosPassword);

// Print receipt via configured printer
router.post('/print-receipt', settingsController.printReceipt);

// Proxy print to Printer Agent on cashier PC
router.post('/print-via-agent', settingsController.printViaAgent);

// Print Queue — mobile adds jobs, cashier browser processes them
router.post('/print-queue',        settingsController.addPrintJob);
router.get('/print-queue/pending', settingsController.getPendingPrintJobs);
router.patch('/print-queue/:id',   settingsController.updatePrintJobStatus);

// Print invoice/quotation to thermal printer
router.post('/print-thermal-document', settingsController.printThermalDocument);

// Check if printer exists for a purpose (receipt|invoice|quotation)
router.get('/printers/check', settingsController.checkPrinter);

// Printers CRUD: Admin only
router.get('/printers', settingsController.getPrinters);
router.post('/printers', authorize('Admin'), settingsController.createPrinter);
router.put('/printers/:id', authorize('Admin'), settingsController.updatePrinter);
router.delete('/printers/:id', authorize('Admin'), settingsController.deletePrinter);
router.post('/printers/:id/test', authorize('Admin'), settingsController.testPrinterById);

// Get categories for KOT printer mapping
router.get('/categories', settingsController.getCategories);

// Test printer connection (legacy): Admin only
router.post('/test-printer', authorize('Admin'), settingsController.testPrinter);

// Agent config: get tenant_code + agent_token, regenerate token
router.get('/agent-config', authorize('Admin'), settingsController.getAgentConfig);
router.post('/agent-token/regenerate', authorize('Admin'), settingsController.regenerateAgentToken);

// Logo upload/delete: Admin only
router.post('/logo', authorize('Admin'), settingsController.logoUploadMiddleware, settingsController.uploadLogo);
router.delete('/logo', authorize('Admin'), settingsController.deleteLogo);

// System info: Admin only
router.get('/system-info', authorize('Admin'), settingsController.getSystemInfo);

module.exports = router;
