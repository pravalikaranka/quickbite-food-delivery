const express = require('express');
const router = express.Router();
const { applyPromo } = require('../controllers/promoController');

router.post('/', applyPromo);

module.exports = router;
