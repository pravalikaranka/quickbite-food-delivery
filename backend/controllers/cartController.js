const db = require('../db');

const getCart = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const loggedInUserId = req.user.id;

  // Authorization check
  if (userId !== loggedInUserId) {
    return res.status(403).json({ error: 'Unauthorized access to cart' });
  }

  try {
    const [rows] = await db.query(
      `SELECT ci.id AS cartItemId, ci.menu_item_id AS id, ci.quantity AS qty, 
              mi.name, mi.price, mi.image, mi.description, mi.restaurant_id AS restaurantId, 
              r.name AS restaurantName, r.delivery_fee AS deliveryFee
       FROM cart_items ci
       JOIN menu_items mi ON ci.menu_item_id = mi.id
       JOIN restaurants r ON mi.restaurant_id = r.id
       WHERE ci.user_id = ?`,
      [userId]
    );

    // Format numbers
    const cart = rows.map(item => ({
      ...item,
      price: parseFloat(item.price),
      deliveryFee: parseFloat(item.deliveryFee)
    }));

    res.status(200).json(cart);
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ error: 'Internal server error fetching cart' });
  }
};

const updateCartItem = async (req, res) => {
  const userId = req.user.id;
  const { menuItemId, quantity } = req.body;

  if (!menuItemId || quantity === undefined) {
    return res.status(400).json({ error: 'menuItemId and quantity are required' });
  }

  try {
    // If quantity is 0 or less, delete the item
    if (quantity <= 0) {
      await db.query('DELETE FROM cart_items WHERE user_id = ? AND menu_item_id = ?', [userId, menuItemId]);
      return res.status(200).json({ message: 'Item removed from cart' });
    }

    // Insert or update quantity
    await db.query(
      `INSERT INTO cart_items (user_id, menu_item_id, quantity) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE quantity = ?`,
      [userId, menuItemId, quantity, quantity]
    );

    res.status(200).json({ message: 'Cart updated successfully' });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ error: 'Internal server error updating cart' });
  }
};

const deleteCartItem = async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.itemId; // Represents the menu_item_id (e.g. 'r1-m1')

  try {
    const [result] = await db.query(
      'DELETE FROM cart_items WHERE user_id = ? AND (menu_item_id = ? OR id = ?)',
      [userId, itemId, itemId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    res.status(200).json({ message: 'Cart item deleted successfully' });
  } catch (err) {
    console.error('Delete cart item error:', err);
    res.status(500).json({ error: 'Internal server error deleting cart item' });
  }
};

module.exports = { getCart, updateCartItem, deleteCartItem };
