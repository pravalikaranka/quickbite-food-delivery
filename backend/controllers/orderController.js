const db = require('../db');

const createOrder = async (req, res) => {
  const userId = req.user.id;
  const {
    restaurantId,
    items,
    promoCode,
    recipientName,
    shippingAddress,
    phoneNumber,
    paymentMethod,
    cardLastFour
  } = req.body;

  if (!restaurantId || !items || items.length === 0 || !recipientName || !shippingAddress || !phoneNumber || !paymentMethod) {
    return res.status(400).json({ error: 'Missing required order details' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch Restaurant details to get delivery fee
    const [restaurants] = await conn.query('SELECT name, delivery_fee FROM restaurants WHERE id = ?', [restaurantId]);
    if (restaurants.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    const deliveryFee = parseFloat(restaurants[0].delivery_fee);
    const platformFee = 0.99;

    // 2. Calculate Subtotal and validate items
    let subtotal = 0;
    for (const item of items) {
      const [menuItems] = await conn.query('SELECT price FROM menu_items WHERE id = ? AND restaurant_id = ?', [item.id, restaurantId]);
      if (menuItems.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: `Menu item ${item.id} not found or doesn't belong to restaurant` });
      }
      const price = parseFloat(menuItems[0].price);
      subtotal += price * item.qty;
    }

    // 3. Apply Promo Code if provided
    let discountAmount = 0.00;
    if (promoCode) {
      const [promos] = await conn.query('SELECT * FROM promo_codes WHERE code = ? AND active = 1', [promoCode]);
      if (promos.length > 0) {
        const promo = promos[0];
        const discValue = parseFloat(promo.discount);
        if (promo.type === 'percent') {
          discountAmount = subtotal * discValue;
        } else if (promo.type === 'flat') {
          discountAmount = Math.min(subtotal, discValue);
        } else if (promo.type === 'delivery') {
          discountAmount = deliveryFee;
        }
      }
    }

    // 4. Calculate Taxes and Total
    const taxAmount = subtotal * 0.08;
    const totalAmount = Math.max(0, subtotal + deliveryFee + platformFee + taxAmount - discountAmount);

    // 5. Insert order
    const [orderResult] = await conn.query(
      `INSERT INTO orders 
       (user_id, restaurant_id, status, total_amount, promo_code, discount_amount, delivery_fee, platform_fee, tax_amount, recipient_name, shipping_address, phone_number, payment_method, card_last_four) 
       VALUES (?, ?, 'ordered', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        restaurantId,
        totalAmount,
        promoCode || null,
        discountAmount,
        deliveryFee,
        platformFee,
        taxAmount,
        recipientName,
        shippingAddress,
        phoneNumber,
        paymentMethod,
        cardLastFour || null
      ]
    );

    const orderId = orderResult.insertId;

    // 6. Insert order items
    for (const item of items) {
      const [menuItems] = await conn.query('SELECT price FROM menu_items WHERE id = ?', [item.id]);
      const price = parseFloat(menuItems[0].price);
      await conn.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.id, item.qty, price]
      );
    }

    // 7. Clear user's cart
    await conn.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    await conn.commit();
    res.status(201).json({
      message: 'Order placed successfully',
      orderId,
      totalAmount
    });
  } catch (err) {
    await conn.rollback();
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Internal server error processing order' });
  } finally {
    conn.release();
  }
};

const getUserOrders = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const loggedInUserId = req.user.id;

  if (userId !== loggedInUserId) {
    return res.status(403).json({ error: 'Unauthorized access to user orders' });
  }

  try {
    const [rows] = await db.query(
      `SELECT o.*, r.name AS restaurantName, r.image AS restaurantImage 
       FROM orders o 
       JOIN restaurants r ON o.restaurant_id = r.id 
       WHERE o.user_id = ? 
       ORDER BY o.created_at DESC`,
      [userId]
    );

    const orders = rows.map(o => ({
      ...o,
      total_amount: parseFloat(o.total_amount),
      discount_amount: parseFloat(o.discount_amount),
      delivery_fee: parseFloat(o.delivery_fee),
      platform_fee: parseFloat(o.platform_fee),
      tax_amount: parseFloat(o.tax_amount)
    }));

    res.status(200).json(orders);
  } catch (err) {
    console.error('Fetch orders error:', err);
    res.status(500).json({ error: 'Internal server error fetching orders' });
  }
};

const getOrderById = async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const [orders] = await db.query(
      `SELECT o.*, r.name AS restaurantName, r.image AS restaurantImage 
       FROM orders o 
       JOIN restaurants r ON o.restaurant_id = r.id 
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Check authorization
    if (order.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to this order' });
    }

    // Get order items
    const [items] = await db.query(
      `SELECT oi.*, mi.name, mi.image 
       FROM order_items oi 
       JOIN menu_items mi ON oi.menu_item_id = mi.id 
       WHERE oi.order_id = ?`,
      [id]
    );

    const formattedOrder = {
      ...order,
      total_amount: parseFloat(order.total_amount),
      discount_amount: parseFloat(order.discount_amount),
      delivery_fee: parseFloat(order.delivery_fee),
      platform_fee: parseFloat(order.platform_fee),
      tax_amount: parseFloat(order.tax_amount)
    };

    const formattedItems = items.map(item => ({
      ...item,
      price: parseFloat(item.price)
    }));

    res.status(200).json({
      order: formattedOrder,
      items: formattedItems
    });
  } catch (err) {
    console.error('Fetch order details error:', err);
    res.status(500).json({ error: 'Internal server error fetching order details' });
  }
};

module.exports = { createOrder, getUserOrders, getOrderById };
