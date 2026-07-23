const express = require('express');
const router = express.Router();
const { getOrderById } = require('../controllers/orderController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/:id', authenticateToken, getOrderById);

module.exports = router;
