import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { uploadDocument, getDocument, deleteDocument } from '../controllers/invoiceDocumentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpg|jpeg|png/;
    allowed.test(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new Error('Only PDF, JPG, PNG files allowed'));
  },
});

router.use(protect);
router.post('/', upload.single('file'), uploadDocument);
router.get('/:id', getDocument);
router.delete('/:id', authorize('admin'), deleteDocument);

export default router;
