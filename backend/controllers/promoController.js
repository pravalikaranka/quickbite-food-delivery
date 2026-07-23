const db = require('../db');

const applyPromo = async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Promo code is required' });
  }

  try {
    const [rows] = await db.query('SELECT code, discount, type, description, active FROM promo_codes WHERE code = ?', [code]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid promotion code' });
    }

    const promo = rows[0];

    if (!promo.active) {
      return res.status(400).json({ error: 'This promotion code has expired' });
    }

    res.status(200).json({
      code: promo.code,
      discount: parseFloat(promo.discount),
      type: promo.type,
      description: promo.description
    });
  } catch (err) {
    console.error('Apply promo error:', err);
    res.status(500).json({ error: 'Internal server error validating promo code' });
  }
};

module.exports = { applyPromo };
