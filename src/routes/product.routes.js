import { Router } from 'express';

import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStock,
} from '../controllers/productController.js';

import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/low-stock', getLowStock);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', authorize('admin'), deleteProduct);

export default router;