import { Router } from 'express';
import { getTransactions, getProductTransactions } from '../controllers/inventoryController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);
router.get('/', getTransactions);
router.get('/product/:productId', getProductTransactions);

export default router;
