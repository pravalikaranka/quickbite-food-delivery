const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const cartRoutes = require('./routes/cart');
const ordersRoutes = require('./routes/orders');
const orderRoutes = require('./routes/order');
const favoritesRoutes = require('./routes/favorites');
const promoRoutes = require('./routes/promo');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all routes (important for frontend communication)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Mount Routes
app.use('/', authRoutes); // Handles POST /register, POST /login, GET /profile
app.use('/restaurants', restaurantRoutes); // Handles GET /restaurants, GET /restaurants/:id, GET /restaurants/:id/menu
app.use('/cart', cartRoutes); // Handles POST /cart, GET /cart/:userId, DELETE /cart/:itemId
app.use('/orders', ordersRoutes); // Handles POST /orders, GET /orders/:userId
app.use('/order', orderRoutes); // Handles GET /order/:id
app.use('/favorites', favoritesRoutes); // Handles POST /favorites, DELETE /favorites, GET /favorites/:userId
app.use('/applyPromo', promoRoutes); // Handles POST /applyPromo

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`QuickBite backend server running on port ${PORT}`);
});
