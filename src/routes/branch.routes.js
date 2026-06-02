import { Router } from 'express';

import {
  createBranch,
  getBranches,
  getBranch,
  updateBranch,
  deleteBranch,
} from '../controllers/branchController.js';

import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', getBranches);
router.get('/:id', getBranch);
router.post('/', createBranch);
router.put('/:id', updateBranch);
router.delete('/:id', authorize('admin'), deleteBranch);

export default router;