const express = require('express');
const router = express.Router();
const { getRestaurants, getRestaurantById, getRestaurantMenu } = require('../controllers/restaurantController');

router.get('/', getRestaurants);
router.get('/:id', getRestaurantById);
router.get('/:id/menu', getRestaurantMenu);

module.exports = router;
