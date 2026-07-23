const db = require('../db');

const addFavorite = async (req, res) => {
  const userId = req.user.id;
  const { restaurantId } = req.body;

  if (!restaurantId) {
    return res.status(400).json({ error: 'restaurantId is required' });
  }

  try {
    // Check if restaurant exists
    const [restaurants] = await db.query('SELECT id FROM restaurants WHERE id = ?', [restaurantId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    await db.query(
      'INSERT IGNORE INTO favorites (user_id, restaurant_id) VALUES (?, ?)',
      [userId, restaurantId]
    );

    res.status(201).json({ message: 'Restaurant added to favorites' });
  } catch (err) {
    console.error('Add favorite error:', err);
    res.status(500).json({ error: 'Internal server error saving favorite' });
  }
};

const removeFavorite = async (req, res) => {
  const userId = req.user.id;
  // Support getting restaurantId from body or query params (DELETE sometimes omits body)
  const restaurantId = req.body.restaurantId || req.query.restaurantId;

  if (!restaurantId) {
    return res.status(400).json({ error: 'restaurantId is required' });
  }

  try {
    const [result] = await db.query(
      'DELETE FROM favorites WHERE user_id = ? AND restaurant_id = ?',
      [userId, restaurantId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.status(200).json({ message: 'Restaurant removed from favorites' });
  } catch (err) {
    console.error('Remove favorite error:', err);
    res.status(500).json({ error: 'Internal server error deleting favorite' });
  }
};

const getFavorites = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const loggedInUserId = req.user.id;

  if (userId !== loggedInUserId) {
    return res.status(403).json({ error: 'Unauthorized access to favorites' });
  }

  try {
    const [rows] = await db.query(
      `SELECT r.id, r.name, r.image, r.rating, r.reviews_count AS reviewsCount, r.cuisines, 
              r.delivery_time AS deliveryTime, r.distance, r.delivery_fee AS deliveryFee, 
              r.price_range AS priceRange, r.tag, r.category 
       FROM favorites f 
       JOIN restaurants r ON f.restaurant_id = r.id 
       WHERE f.user_id = ?`,
      [userId]
    );

    // Format fields (cuisines, rating, deliveryFee)
    const favorites = rows.map(r => ({
      ...r,
      rating: parseFloat(r.rating),
      deliveryFee: parseFloat(r.deliveryFee),
      cuisines: r.cuisines ? r.cuisines.split(',').map(c => c.trim()) : []
    }));

    res.status(200).json(favorites);
  } catch (err) {
    console.error('Fetch favorites error:', err);
    res.status(500).json({ error: 'Internal server error fetching favorites' });
  }
};

module.exports = { addFavorite, removeFavorite, getFavorites };
