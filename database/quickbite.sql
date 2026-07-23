CREATE DATABASE IF NOT EXISTS quickbite;
USE quickbite;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  address VARCHAR(255) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  card_name VARCHAR(100) DEFAULT '',
  card_number VARCHAR(20) DEFAULT '',
  card_expiry VARCHAR(7) DEFAULT '',
  card_cvv VARCHAR(4) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. RESTAURANTS TABLE
CREATE TABLE IF NOT EXISTS restaurants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  image VARCHAR(255) NOT NULL,
  rating DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  reviews_count INT NOT NULL DEFAULT 0,
  cuisines VARCHAR(255) NOT NULL, -- comma separated, e.g. "Gourmet Burgers, Sides, Milkshakes"
  delivery_time VARCHAR(20) NOT NULL,
  distance VARCHAR(20) NOT NULL,
  delivery_fee DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  price_range VARCHAR(5) NOT NULL DEFAULT '$$',
  tag VARCHAR(50) DEFAULT NULL,
  category VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(50) PRIMARY KEY, -- e.g., 'r1-m1', 'r2-m1'
  restaurant_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  image VARCHAR(255) NOT NULL,
  diet ENUM('veg', 'nonveg') NOT NULL DEFAULT 'veg',
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. CART ITEMS TABLE
CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  menu_item_id VARCHAR(50) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_item (user_id, menu_item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  status ENUM('ordered', 'preparing', 'dispatched', 'delivered') NOT NULL DEFAULT 'ordered',
  total_amount DECIMAL(10,2) NOT NULL,
  promo_code VARCHAR(50) DEFAULT NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  delivery_fee DECIMAL(5,2) NOT NULL,
  platform_fee DECIMAL(5,2) NOT NULL DEFAULT 0.99,
  tax_amount DECIMAL(10,2) NOT NULL,
  recipient_name VARCHAR(100) NOT NULL,
  shipping_address VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  payment_method VARCHAR(20) NOT NULL, -- e.g., 'card', 'applepay', 'cod'
  card_last_four VARCHAR(4) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. PROMO CODES TABLE
CREATE TABLE IF NOT EXISTS promo_codes (
  code VARCHAR(50) PRIMARY KEY,
  discount DECIMAL(5,2) NOT NULL, -- e.g. 0.50 for percent, or 5.00 for flat
  type ENUM('percent', 'flat', 'delivery') NOT NULL DEFAULT 'percent',
  description VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. FAVORITES TABLE
CREATE TABLE IF NOT EXISTS favorites (
  user_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  PRIMARY KEY (user_id, restaurant_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --- SEED DATA ---

-- Seed Restaurants
INSERT INTO restaurants (id, name, image, rating, reviews_count, cuisines, delivery_time, distance, delivery_fee, price_range, tag, category) VALUES
(1, 'Burger Craft & Co.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', 4.8, 340, 'Gourmet Burgers, Sides, Milkshakes', '15-25 min', '1.2 km', 1.99, '$$', 'Free Delivery', 'Burgers'),
(2, 'La Bella Vita Pizzeria', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80', 4.7, 520, 'Wood-fired Pizza, Pasta, Italian', '25-35 min', '2.4 km', 2.99, '$$', 'Buy 1 Get 1', 'Pizza'),
(3, 'Sakura Zen Sushi', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80', 4.9, 280, 'Sushi, Sashimi, Japanese Platters', '20-30 min', '0.8 km', 0.00, '$$$', 'Chef Special', 'Sushi'),
(4, 'The Green Lotus Café', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80', 4.6, 190, 'Salads, Smoothies, Healthy Bowls', '10-20 min', '1.5 km', 1.99, '$$', 'Trending', 'Healthy'),
(5, 'Tokyo Ramen House', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80', 4.8, 420, 'Tonkotsu Ramen, Gyoza, Asian Bowls', '30-40 min', '3.1 km', 3.49, '$$', 'High Rated', 'Asian'),
(6, 'Velvet Delights Patisserie', 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80', 4.9, 150, 'Desserts, Artisanal Cakes, Pastries', '15-30 min', '1.8 km', 2.49, '$$$', 'Sweet Treat', 'Desserts');

-- Seed Menu Items
INSERT INTO menu_items (id, restaurant_id, name, price, description, image, diet, popular) VALUES
-- Burger Craft & Co. (Rest 1)
('r1-m1', 1, 'The Truffle Baron Burger', 14.99, 'Aged Angus beef patty, black truffle aioli, wild mushrooms, Swiss cheese, and caramelized onions on a brioche bun.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80', 'nonveg', TRUE),
('r1-m2', 1, 'Avocado Crunch (Vegan)', 12.99, 'Crispy plant-based patty, smashed avocado, heirloom tomato, sprouts, and vegan lime crema.', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=300&q=80', 'veg', TRUE),
('r1-m3', 1, 'Truffle Parmesan Fries', 5.99, 'Hand-cut Idaho potatoes tossed in white truffle oil, grated parmesan cheese, and fresh parsley.', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=300&q=80', 'veg', FALSE),
('r1-m4', 1, 'Spiced Maple Wings', 9.99, 'Crispy chicken wings glazed in a spicy sweet maple-sriracha sauce.', 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=300&q=80', 'nonveg', FALSE),

-- La Bella Vita Pizzeria (Rest 2)
('r2-m1', 2, 'Burrata & Prosciutto Pizza', 18.99, 'San Marzano tomatoes, fresh burrata ball, prosciutto di Parma, wild arugula, and a drizzle of hot honey.', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80', 'nonveg', TRUE),
('r2-m2', 2, 'Classic Margherita DOC', 13.99, 'Buffalo mozzarella, San Marzano tomatoes, fresh basil leaves, and extra virgin olive oil on wood-fired crust.', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=300&q=80', 'veg', TRUE),
('r2-m3', 2, 'Cacio e Pepe Pasta', 15.99, 'Fresh tonnarelli pasta tossed in a creamy emulsification of Pecorino Romano cheese and toasted black peppercorns.', 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=300&q=80', 'veg', FALSE),

-- Sakura Zen Sushi (Rest 3)
('r3-m1', 3, 'Signature Dragon Roll', 16.99, 'Shrimp tempura and cucumber inside, topped with avocado slices, grilled eel, spicy mayo, and unagi sauce.', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=300&q=80', 'nonveg', TRUE),
('r3-m2', 3, 'Imperial Sashimi Platter', 28.99, '15 pieces of premium sliced raw seafood (Bluefin tuna, salmon, yellowtail, red snapper, scallop).', 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=300&q=80', 'nonveg', TRUE),
('r3-m3', 3, 'Veggie Zen Garden Roll', 11.99, 'Asparagus, sweet potato tempura, pickled radish, and cucumber wrapped in soy paper, topped with roasted sesame.', 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=300&q=80', 'veg', FALSE),

-- The Green Lotus Café (Rest 4)
('r4-m1', 4, 'Quinoa Superfood Bowl', 11.99, 'Warm quinoa, massaged kale, roasted sweet potato, edamame, pumpkin seeds, and tahini-ginger dressing.', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&q=80', 'veg', TRUE),
('r4-m2', 4, 'Grilled Ginger-Salmon Salad', 16.99, 'Atlantic salmon, mixed greens, avocado, oranges, and cucumber with toasted almonds and citrus-ginger vinaigrette.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80', 'nonveg', TRUE),
('r4-m3', 4, 'Açai Berry Supercharge Bowl', 8.99, 'Organic açai purée topped with gluten-free hemp granola, organic bananas, wild berries, and chia seeds.', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=300&q=80', 'veg', FALSE),

-- Tokyo Ramen House (Rest 5)
('r5-m1', 5, 'Spicy Tonkotsu Red Ramen', 15.49, 'Rich 16-hour pork bone broth, thin noodles, chashu pork, soft ajitama egg, bamboo shoots, and spicy black garlic oil.', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=300&q=80', 'nonveg', TRUE),
('r5-m2', 5, 'Vegan Spicy Cream Miso', 14.49, 'Creamy white miso vegetable broth, wavy noodles, fried silken tofu, wood ear mushrooms, corn, and chili threads.', 'https://images.unsplash.com/photo-1547928500-4c7644d6735a?auto=format&fit=crop&w=300&q=80', 'veg', TRUE),
('r5-m3', 5, 'Pan-Seared Pork Gyoza', 6.99, 'Crispy pan-fried dumplings filled with seasoned pork and scallions, served with dynamic soy-vinegar dip.', 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=300&q=80', 'nonveg', FALSE),

-- Velvet Delights Patisserie (Rest 6)
('r6-m1', 6, 'Lava Cake & Madagascar Vanilla', 9.99, 'Molten Valrhona dark chocolate cake with a liquid core, served with a scoop of real vanilla bean gelato.', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=300&q=80', 'veg', TRUE),
('r6-m2', 6, 'Pistachio Raspberry Macaron Box', 12.49, 'Box of 6 signature macarons filled with Iranian pistachio butter and fresh raspberry jam.', 'https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=300&q=80', 'veg', TRUE),
('r6-m3', 6, 'Matcha Crepe Gateau Slice', 7.99, '20 layers of paper-thin French crepes filled with silky Uji matcha cream.', 'https://images.unsplash.com/photo-1536680465769-236b20f75273?auto=format&fit=crop&w=300&q=80', 'veg', FALSE);

-- Seed Promo Codes
INSERT INTO promo_codes (code, discount, type, description, active) VALUES
('SAVE50', 0.50, 'percent', '50% off your items', TRUE),
('SAVE20', 0.20, 'percent', '20% off your order', TRUE),
('FREEDEL', 5.00, 'delivery', 'Free delivery fee', TRUE),
('WELCOME10', 10.00, 'flat', '$10.00 flat discount', TRUE);
