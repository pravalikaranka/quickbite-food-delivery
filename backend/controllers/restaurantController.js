const db = require('../db');

const getRestaurants = async (req, res) => {
  const { category, search, sortBy } = req.query;

  try {
    let query = 'SELECT id, name, image, rating, reviews_count AS reviewsCount, cuisines, delivery_time AS deliveryTime, distance, delivery_fee AS deliveryFee, price_range AS priceRange, tag, category FROM restaurants';
    const params = [];
    const conditions = [];

    if (category && category !== 'All') {
      conditions.push('category = ?');
      params.push(category);
    }

    if (search) {
      conditions.push('(name LIKE ? OR cuisines LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Add Sorting
    if (sortBy === 'rating') {
      query += ' ORDER BY rating DESC';
    } else if (sortBy === 'deliveryTime') {
      query += ' ORDER BY CAST(SUBSTRING_INDEX(deliveryTime, "-", 1) AS UNSIGNED) ASC';
    } else if (sortBy === 'distance') {
      query += ' ORDER BY CAST(SUBSTRING_INDEX(distance, " ", 1) AS DECIMAL(5,2)) ASC';
    }

    const [rows] = await db.query(query, params);

    // Format cuisines from comma-separated string to array
    const restaurants = rows.map(r => ({
      ...r,
      rating: parseFloat(r.rating),
      deliveryFee: parseFloat(r.deliveryFee),
      cuisines: r.cuisines ? r.cuisines.split(',').map(c => c.trim()) : []
    }));

    res.status(200).json(restaurants);
  } catch (err) {
    console.error('Fetch restaurants error:', err);
    res.status(500).json({ error: 'Internal server error fetching restaurants' });
  }
};

const getRestaurantById = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const [rows] = await db.query(
      'SELECT id, name, image, rating, reviews_count AS reviewsCount, cuisines, delivery_time AS deliveryTime, distance, delivery_fee AS deliveryFee, price_range AS priceRange, tag, category FROM restaurants WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const r = rows[0];
    const restaurant = {
      ...r,
      rating: parseFloat(r.rating),
      deliveryFee: parseFloat(r.deliveryFee),
      cuisines: r.cuisines ? r.cuisines.split(',').map(c => c.trim()) : []
    };

    res.status(200).json(restaurant);
  } catch (err) {
    console.error('Fetch restaurant details error:', err);
    res.status(500).json({ error: 'Internal server error fetching restaurant details' });
  }
};

const getRestaurantMenu = async (req, res) => {
  const restaurantId = parseInt(req.params.id);

  try {
    const [rows] = await db.query(
      'SELECT id, restaurant_id AS restaurantId, name, price, description, image, diet, popular FROM menu_items WHERE restaurant_id = ?',
      [restaurantId]
    );

    const menu = rows.map(item => ({
      ...item,
      price: parseFloat(item.price),
      popular: !!item.popular
    }));

    res.status(200).json(menu);
  } catch (err) {
    console.error('Fetch menu items error:', err);
    res.status(500).json({ error: 'Internal server error fetching menu' });
  }
};

module.exports = { getRestaurants, getRestaurantById, getRestaurantMenu };
