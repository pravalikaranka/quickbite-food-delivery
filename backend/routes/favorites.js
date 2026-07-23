const express = require('express');
const router = express.Router();
const { addFavorite, removeFavorite, getFavorites } = require('../controllers/favoriteController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/', authenticateToken, addFavorite);
router.delete('/', authenticateToken, removeFavorite);
router.get('/:userId', authenticateToken, getFavorites);

module.exports = router;
