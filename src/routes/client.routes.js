const express = require('express');
const router = express.Router();
const { getClients, getClient, createClient, updateClient, deleteClient } = require('../controllers/clientController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getClients);
router.get('/:id', getClient);
router.post('/', createClient);
router.put('/:id', updateClient);
router.delete('/:id', authorize('admin'), deleteClient);

module.exports = router;
