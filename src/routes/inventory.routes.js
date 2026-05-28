const express = require('express');
const router = express.Router();
const { getTransactions, getProductTransactions } = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getTransactions);
router.get('/product/:productId', getProductTransactions);

module.exports = router;
