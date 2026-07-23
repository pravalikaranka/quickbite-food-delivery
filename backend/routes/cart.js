const express = require('express');
const router = express.Router();
const { getCart, updateCartItem, deleteCartItem } = require('../controllers/cartController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/', authenticateToken, updateCartItem);
router.get('/:userId', authenticateToken, getCart);
router.delete('/:itemId', authenticateToken, deleteCartItem);

module.exports = router;
