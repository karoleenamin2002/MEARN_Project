import { Router } from 'express';
import { getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, getStats } from '../controllers/invoiceController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);
router.get('/stats', getStats);
router.get('/', getInvoices);
router.get('/:id', getInvoice);
router.post('/', createInvoice);
router.put('/:id', authorize('admin'), updateInvoice);
router.delete('/:id', authorize('admin'), deleteInvoice);

export default router;
