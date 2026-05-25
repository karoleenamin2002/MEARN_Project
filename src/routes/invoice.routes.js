const express = require('express');
const router = express.Router();
const { getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, getStats } = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/stats', getStats);
router.get('/', getInvoices);
router.get('/:id', getInvoice);
router.post('/', createInvoice);
router.put('/:id', authorize('admin'), updateInvoice);
router.delete('/:id', authorize('admin'), deleteInvoice);

module.exports = router;
