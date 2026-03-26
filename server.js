const axios = require("axios");
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const chat = require('./chatbot_server');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/chat', chat);


function generateFraudFeatures(amount) {

    let features = {
        Time: Date.now() % 100000
    };

    for (let i = 1; i <= 28; i++) {
        features["V" + i] = (Math.random() * 2 - 1);
    }

    features.Amount = amount;

    return features;
}

// PostgreSQL connection pool
// const pool = new Pool({
//     user: process.env.DB_USER,
//     host: process.env.DB_HOST,
//     database: process.env.DB_NAME,
//     password: process.env.DB_PASSWORD,
//     port: process.env.DB_PORT
// });
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for most cloud providers like Supabase/Render/Heroku
    }
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Connection error', err.stack);
    } else {
        console.log('Connected to Supabase at:', res.rows[0].now);
    }
});
// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Middleware to check admin access
const isAdmin = async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT is_admin FROM users WHERE id = $1',
            [req.user.userId]
        );
        
        if (result.rows[0]?.is_admin) {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Validation rules
const validateRegistration = [
    
    body('name').notEmpty().withMessage('Name is required'),
    body('age').isInt({ min: 18 }).withMessage('Age must be at least 18'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').matches(/^[0-9]{10}$/).withMessage('Valid 10-digit phone number required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
];

// Routes

// User Registration
app.post('/api/register', validateRegistration, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
         console.log('error')
        return res.status(400).json({ errors: errors.array() });
    }
  console.log('Entered')
    try {
        const { name, age, email, phone, password, address, city, state, pincode } = req.body;
        
        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR phone = $2',
            [email, phone]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists with this email or phone' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user
        const result = await pool.query(
            `INSERT INTO users (name, age, email, phone, password, address, city, state, pincode) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, email`,
            [name, age, email, phone, hashedPassword, address, city, state, pincode]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId: result.rows[0].id, email: result.rows[0].email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login with OTP verification
app.post('/api/login', [
    body('email').isEmail(),
    body('password').notEmpty(),
    body('otp').isLength({ min: 4, max: 4 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password, otp } = req.body;

        // Verify OTP (sample OTP: 1234)
        if (otp !== '1234') {
            return res.status(401).json({ error: 'Invalid OTP' });
        }

        // Get user
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, isAdmin: user.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isAdmin: user.is_admin
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Forgot Password - Send OTP
app.post('/api/forgot-password', [
    body('email').isEmail()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email } = req.body;

        // Check if user exists
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate reset token (in production, save this to database)
        const resetToken = Math.random().toString(36).substring(2, 15);
        
        // Send email (simplified - in production, use proper email)
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            text: `Your password reset OTP is: 1234`
        };

        // Uncomment in production
        // await transporter.sendMail(mailOptions);

        res.json({ message: 'OTP sent to your email' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reset Password
app.post('/api/reset-password', [
    body('email').isEmail(),
    body('otp').isLength({ min: 4, max: 4 }),
    body('newPassword').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, otp, newPassword } = req.body;

        // Verify OTP (sample)
        if (otp !== '1234') {
            return res.status(401).json({ error: 'Invalid OTP' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query(
            'UPDATE users SET password = $1 WHERE email = $2',
            [hashedPassword, email]
        );

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get User Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, age, email, phone, address, city, state, pincode, created_at FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update User Profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { name, age, phone, address, city, state, pincode } = req.body;
        
        const result = await pool.query(
            `UPDATE users 
             SET name = $1, age = $2, phone = $3, address = $4, city = $5, state = $6, pincode = $7, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $8 
             RETURNING id, name, age, email, phone, address, city, state, pincode`,
            [name, age, phone, address, city, state, pincode, req.user.userId]
        );

        res.json({ message: 'Profile updated successfully', user: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Change Password
app.post('/api/change-password', authenticateToken, [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { currentPassword, newPassword } = req.body;

        // Get user with password
        const result = await pool.query(
            'SELECT password FROM users WHERE id = $1',
            [req.user.userId]
        );

        const user = result.rows[0];

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query(
            'UPDATE users SET password = $1 WHERE id = $2',
            [hashedPassword, req.user.userId]
        );

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Products
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM products ORDER BY id'
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add to Cart
app.post('/api/cart', authenticateToken, async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        // Check if product exists and has sufficient stock
        const product = await pool.query(
            'SELECT * FROM products WHERE id = $1',
            [productId]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (product.rows[0].stock_quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        // Add to cart
        const result = await pool.query(
            `INSERT INTO cart (user_id, product_id, quantity) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (user_id, product_id) 
             DO UPDATE SET quantity = cart.quantity + $3 
             RETURNING *`,
            [req.user.userId, productId, quantity]
        );

        res.status(201).json({ message: 'Added to cart', cart: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Cart Items
app.get('/api/cart', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, p.name, p.price, p.image_url, p.description 
             FROM cart c 
             JOIN products p ON c.product_id = p.id 
             WHERE c.user_id = $1`,
            [req.user.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Cart Item
app.put('/api/cart/:id', authenticateToken, async (req, res) => {
    try {
        const { quantity } = req.body;
        
        const result = await pool.query(
            'UPDATE cart SET quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
            [quantity, req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        res.json({ message: 'Cart updated', cart: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Remove from Cart
app.delete('/api/cart/:id', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.user.userId;
    const result = await pool.query(
      'DELETE FROM cart WHERE id = $1 AND user_id = $2 RETURNING *',
      [itemId, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item removed', deleted: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create Order
app.post('/api/orders', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const { shippingAddress, shippingCity, shippingState, shippingPincode, paymentMethod } = req.body;

        // Get cart items
        const cartItems = await client.query(
            `SELECT c.*, p.name, p.price, p.stock_quantity 
             FROM cart c 
             JOIN products p ON c.product_id = p.id 
             WHERE c.user_id = $1`,
            [req.user.userId]
        );

        if (cartItems.rows.length === 0) {
            throw new Error('Cart is empty');
        }

        // Calculate total
        let totalAmount = 0;
        for (const item of cartItems.rows) {
            totalAmount += item.price * item.quantity;
            
            // Check stock
            if (item.stock_quantity < item.quantity) {
                throw new Error(`Insufficient stock for ${item.name}`);
            }
        }

        // Create order
        const order = await client.query(
            `INSERT INTO orders (user_id, total_amount, shipping_address, shipping_city, shipping_state, shipping_pincode) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.user.userId, totalAmount, shippingAddress, shippingCity, shippingState, shippingPincode]
        );

        // Create order items and update stock
        for (const item of cartItems.rows) {
            await client.query(
                `INSERT INTO order_items (order_id, product_id, product_name, quantity, price, subtotal) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [order.rows[0].id, item.product_id, item.name, item.quantity, item.price, item.price * item.quantity]
            );

            await client.query(
                'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                [item.quantity, item.product_id]
            );
        }

        // Clear cart
        await client.query('DELETE FROM cart WHERE user_id = $1', [req.user.userId]);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Order created successfully',
            orderId: order.rows[0].id
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});
async function checkFraud(features) {

    const response = await axios.post(
        "http://127.0.0.1:5000/predict",
        features
    );

    console.log("Fraud result:", response.data);

    return response.data;
}
app.post('/api/payment', authenticateToken, async (req, res) => {

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        const { orderId, paymentMethod, cardDetails } = req.body;

        // Generate transaction ID
        const transactionId = 'TXN' + Date.now() + Math.random().toString(36).substring(2, 7);

        // Get order details
        const order = await client.query(
            'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, req.user.userId]
        );

        if (order.rows.length === 0) {
            throw new Error('Order not found');
        }

        const amount = order.rows[0].total_amount;

        // 🟢 Fraud Detection (ML API)
        // Current time features
const hour = new Date().getHours();
const dayOfWeek = new Date().getDay();

// Average transaction amount
const avgQuery = await client.query(
    `SELECT AVG(amount) FROM transactions WHERE user_id=$1`,
    [req.user.userId]
);
const userIP = req.ip;
console.log("User IP:", userIP);
const avgAmount = parseFloat(avgQuery.rows[0].avg) || 0;
const axios = require("axios");

const ipData = await axios.get(`http://ip-api.com/json/${userIP}`);

const lat = ipData.data.lat;
const lon = ipData.data.lon;

const userHome = {
  lat: 13.0827,
  lon: 80.2707
};

function getDistance(lat1, lon1, lat2, lon2) {

 const R = 6371; // km

 const dLat = (lat2 - lat1) * Math.PI / 180;
 const dLon = (lon2 - lon1) * Math.PI / 180;

 const a =
   Math.sin(dLat/2) * Math.sin(dLat/2) +
   Math.cos(lat1 * Math.PI / 180) *
   Math.cos(lat2 * Math.PI / 180) *
   Math.sin(dLon/2) *
   Math.sin(dLon/2);

 const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

 return R * c;
}
const distance = getDistance(
 userHome.lat,
 userHome.lon,
 lat,
 lon
);


// Amount deviation
const deviation = amount - avgAmount;

// Transactions last 10 minutes
const tx10 = await client.query(
    `SELECT COUNT(*) FROM transactions
     WHERE user_id=$1
     AND transaction_date > NOW() - INTERVAL '10 minutes'`,
    [req.user.userId]
);

// Transactions last 1 hour
const tx1h = await client.query(
    `SELECT COUNT(*) FROM transactions
     WHERE user_id=$1
     AND transaction_date > NOW() - INTERVAL '1 hour'`,
    [req.user.userId]
);

// Transactions today
const txToday = await client.query(
    `SELECT COUNT(*) FROM transactions
     WHERE user_id=$1
     AND DATE(transaction_date) = CURRENT_DATE`,
    [req.user.userId]
);

// Merchant risk score (default example)
let merchantRisk = 5;

// First time merchant
const merchantCheck = await client.query(
    `SELECT COUNT(*) FROM transactions
     WHERE user_id=$1 AND order_id=$2`,
    [req.user.userId, orderId]
);

const firstMerchant = merchantCheck.rows[0].count == 0 ? 1 : 0;


// Card flags
const cardNotPresent = paymentMethod === "card" ? 1 : 0;
const internationalTx = 0;

// Encode payment method
let paymentMethodEncoded = 0;

if (paymentMethod === "card") paymentMethodEncoded = 0;
if (paymentMethod === "upi") paymentMethodEncoded = 1;
if (paymentMethod === "netbanking") paymentMethodEncoded = 2;

// get browser/device information
// get browser/device information
const userAgent = req.headers['user-agent'] || "unknown";

let deviceType = 1;
if (userAgent.includes("Mobile")) {
    deviceType = 0;
}

// simulate stored device
const storedDevice = "known_device";

// simulate current device fingerprint
const currentDevice = userAgent;

// detect new device
const newDevice = storedDevice !== currentDevice ? 1 : 0;

// simulate stored location
const storedLocation = {
    lat: 12.9716,
    lon: 77.5946
};

// simulate current location
const currentLocation = {
    lat: 12.9716,
    lon: 77.5946
};

// simple distance calculation
const locationDistance = Math.sqrt(
    Math.pow(currentLocation.lat - storedLocation.lat, 2) +
    Math.pow(currentLocation.lon - storedLocation.lon, 2)
);
// Fraud feature object
const features = {
    amount: amount,
    hour_of_day: hour,
    day_of_week: dayOfWeek,
    payment_method: paymentMethodEncoded,
    avg_transaction_amount: avgAmount,
    transaction_amount_deviation: deviation,
    transactions_last_10min: parseInt(tx10.rows[0].count),
    transactions_last_1hour: parseInt(tx1h.rows[0].count),
    transactions_today: parseInt(txToday.rows[0].count),
    merchant_risk_score: merchantRisk,
    first_time_merchant: firstMerchant,
    new_device: newDevice,
    device_type: deviceType,
    location_distance: distance,
    card_not_present: cardNotPresent,
    international_transaction: internationalTx
};

// Call Python ML API
const fraudResponse = await axios.post("http://127.0.0.1:5000/predict", features);

console.log("Fraud result:", fraudResponse.data);

const fraudPrediction = fraudResponse.data.fraud_prediction;
const fraudScore = fraudResponse.data.fraud_score;
console.log("Fraud prediction:", fraudPrediction);
console.log("Fraud Score:", fraudScore);

        let paymentStatus = "completed";
        let fraudFlag = 0;

// ML fraud decision
if (fraudScore && fraudScore > 0.7) {
    paymentStatus = "blocked";
    fraudFlag = 1;
}
const now = new Date();
const hour_of_day = now.getHours();
if (hour_of_day >= 1 && hour_of_day <= 4 && amount > 100000) {
    fraudScore += 0.15;
}
// Extra rule: very high amount
if (amount > 150000) {
    paymentStatus = "blocked";
    fraudFlag = 1;
}

if (paymentMethodEncoded === 1) { // UPI
    if (tx10 > 3) {
        merchantRisk = 8; // suspicious
    }
}
if (paymentMethodEncoded === 2) { // netbanking
    if (amount > 100000) {
        merchantRisk = 9;
    }
}

        // 🟢 Insert transaction (ALWAYS SAVE)
       const transaction = await client.query(
    `INSERT INTO transactions 
    (order_id, user_id, amount, payment_method, transaction_id, payment_status, fraud_flag, fraud_score, fraud_checked)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,
    [
        orderId,
        req.user.userId,
        amount,
        paymentMethod,
        transactionId,
        paymentStatus,
        fraudFlag,
        fraudScore,
        true
    ]
);

        // 🟢 Update order payment status
        await client.query(
            'UPDATE orders SET payment_status = $1 WHERE id = $2',
            [paymentStatus, orderId]
        );

        // 🟢 Commit database
        await client.query('COMMIT');

        // 🟢 If fraud detected
        if (fraudFlag === 1) {
            return res.status(403).json({
                message: "Transaction blocked - Fraud detected",
                transaction: transaction.rows[0]
            });
        }

        // 🟢 Normal payment
        return res.json({
            message: "Payment successful",
            transaction: transaction.rows[0]
        });

    } catch (error) {

        await client.query('ROLLBACK');

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    } finally {

        client.release();

    }

});
// Get User Orders
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const orders = await pool.query(
            `SELECT o.*, 
              json_agg(json_build_object(
                'id', oi.id,
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'price', oi.price,
                'subtotal', oi.subtotal
              )) as items
             FROM orders o
             LEFT JOIN order_items oi ON o.id = oi.order_id
             WHERE o.user_id = $1
             GROUP BY o.id
             ORDER BY o.order_date DESC`,
            [req.user.userId]
        );

        res.json(orders.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Order Details
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
    try {
        const order = await pool.query(
            `SELECT o.*, 
              json_agg(json_build_object(
                'id', oi.id,
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'price', oi.price,
                'subtotal', oi.subtotal
              )) as items
             FROM orders o
             LEFT JOIN order_items oi ON o.id = oi.order_id
             WHERE o.id = $1 AND o.user_id = $2
             GROUP BY o.id`,
            [req.params.id, req.user.userId]
        );

        if (order.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Get transaction details
        const transaction = await pool.query(
            'SELECT * FROM transactions WHERE order_id = $1',
            [req.params.id]
        );

        res.json({
            ...order.rows[0],
            transaction: transaction.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Generate Payment Receipt PDF

app.get('/api/receipt/:orderId', authenticateToken, async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.user.userId;

        console.log(`📄 Generating receipt for order: ${orderId}, user: ${userId}`);

        // Get order details with user info
        const orderResult = await pool.query(
            `SELECT o.*, u.name, u.email, u.phone 
             FROM orders o
             JOIN users u ON o.user_id = u.id
             WHERE o.id = $1 AND o.user_id = $2`,
            [orderId, userId]
        );

        if (orderResult.rows.length === 0) {
            console.log('❌ Order not found');
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderResult.rows[0];

        // Get order items
        const itemsResult = await pool.query(
            `SELECT * FROM order_items WHERE order_id = $1`,
            [orderId]
        );
        
        const items = itemsResult.rows;

        // Get transaction details
        const transactionResult = await pool.query(
            `SELECT * FROM transactions WHERE order_id = $1`,
            [orderId]
        );
        
        const transaction = transactionResult.rows[0] || {};

        console.log('✅ Order found, generating PDF...');

        // Create PDF document
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=receipt-${orderId}.pdf`);

        // Pipe PDF to response
        doc.pipe(res);

        // Add company logo/header
        doc.fontSize(25)
           .font('Helvetica-Bold')
           .text('ShopEasy', 50, 50)
           .fontSize(12)
           .font('Helvetica')
           .text('Your One-Stop Shop', 50, 80)
           .moveDown();

        // Add receipt title
        doc.moveDown()
           .fontSize(20)
           .font('Helvetica-Bold')
           .text('PAYMENT RECEIPT', { align: 'center' })
           .moveDown();

        // Add receipt details in a box
        doc.rect(50, 150, 500, 100).stroke();
        
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('RECEIPT DETAILS', 60, 160)
           .font('Helvetica')
           .text(`Receipt No: REC-${orderId}-${Date.now()}`, 60, 180)
           .text(`Date: ${new Date(order.order_date).toLocaleString()}`, 60, 195)
           .text(`Order ID: #${orderId}`, 60, 210)
           .text(`Transaction ID: ${transaction.transaction_id || 'N/A'}`, 60, 225);

        // Customer details
        doc.moveDown(4)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('CUSTOMER DETAILS')
           .font('Helvetica')
           .fontSize(10)
           .text(`Name: ${order.name}`)
           .text(`Email: ${order.email}`)
           .text(`Phone: ${order.phone}`)
           .moveDown();

        // Shipping address
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('SHIPPING ADDRESS')
           .font('Helvetica')
           .fontSize(10)
           .text(`${order.shipping_address}`)
           .text(`${order.shipping_city}, ${order.shipping_state} ${order.shipping_pincode}`)
           .moveDown();

        // Items table
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('ORDER ITEMS')
           .moveDown();

        // Table headers
        const tableTop = doc.y;
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Product', 50, tableTop)
           .text('Qty', 300, tableTop)
           .text('Price', 350, tableTop)
           .text('Total', 450, tableTop);

        // Draw line
        doc.moveTo(50, tableTop + 15)
           .lineTo(550, tableTop + 15)
           .stroke();

        let y = tableTop + 25;
        let subtotal = 0;

        // Table rows
        items.forEach(item => {
            doc.font('Helvetica')
               .fontSize(9)
               .text(item.product_name.substring(0, 30), 50, y)
               .text(item.quantity.toString(), 300, y)
               .text(`₹${parseFloat(item.price).toFixed(2)}`, 350, y)
               .text(`₹${parseFloat(item.subtotal).toFixed(2)}`, 450, y);
            
            y += 20;
            subtotal += parseFloat(item.subtotal);
        });

        // Draw line
        doc.moveTo(50, y)
           .lineTo(550, y)
           .stroke();

        y += 10;

        // Calculate totals
        const shipping = subtotal > 999 ? 0 : 40;
        const tax = subtotal * 0.18;
        const total = subtotal + shipping + tax;

        // Summary
        doc.fontSize(10)
           .font('Helvetica')
           .text('Subtotal:', 350, y)
           .text(`₹${subtotal.toFixed(2)}`, 450, y)
           .text('Shipping:', 350, y + 15)
           .text(shipping === 0 ? 'FREE' : `₹${shipping.toFixed(2)}`, 450, y + 15)
           .text('GST (18%):', 350, y + 30)
           .text(`₹${tax.toFixed(2)}`, 450, y + 30)
           .font('Helvetica-Bold')
           .text('TOTAL:', 350, y + 50)
           .text(`₹${total.toFixed(2)}`, 450, y + 50);

        // Payment details
        doc.moveDown(5)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('PAYMENT DETAILS')
           .font('Helvetica')
           .fontSize(10)
           .text(`Payment Method: ${transaction.payment_method || 'N/A'}`)
           .text(`Payment Status: ${order.payment_status}`)
           .text(`Transaction Date: ${transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleString() : 'N/A'}`);

        // Thank you note
        doc.moveDown(3)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('Thank you for shopping with ShopEasy!', { align: 'center' })
           .fontSize(10)
           .font('Helvetica')
           .text('This is a computer generated receipt.', { align: 'center' });

        // Finalize PDF
        doc.end();

        console.log('✅ PDF generated successfully');

    } catch (error) {
        console.error('❌ Error generating receipt:', error);
        
        // Don't try to send response if headers are already sent
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate receipt' });
        }
    }
});

// Admin Routes

// Get All Transactions (Admin only)
app.get('/api/admin/transactions', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT t.*, u.name as user_name, u.email, o.total_amount as order_amount,t.payment_status,t.fraud_flag
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             JOIN orders o ON t.order_id = o.id
             ORDER BY t.transaction_date DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get All Orders (Admin only)
app.get('/api/admin/orders', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT o.*, u.name as user_name, u.email
             FROM orders o
             JOIN users u ON o.user_id = u.id
             ORDER BY o.order_date DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Dashboard Stats (Admin only)
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
        const totalOrders = await pool.query('SELECT COUNT(*) FROM orders');
        const totalRevenue = await pool.query('SELECT SUM(total_amount) FROM orders WHERE payment_status = $1', ['completed']);
        const recentTransactions = await pool.query(
            `SELECT t.*, u.name FROM transactions t
             JOIN users u ON t.user_id = u.id
             ORDER BY t.transaction_date DESC LIMIT 5`
        );

        res.json({
            totalUsers: totalUsers.rows[0].count,
            totalOrders: totalOrders.rows[0].count,
            totalRevenue: totalRevenue.rows[0].sum || 0,
            recentTransactions: recentTransactions.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Clear cart after payment
app.delete('/api/cart/clear', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        console.log('🗑️ ===== CLEAR CART REQUEST =====');
        console.log('User ID:', userId);
        console.log('Timestamp:', new Date().toISOString());
        
        // First check what's in the cart
        const checkResult = await pool.query(
            'SELECT * FROM cart WHERE user_id = $1',
            [userId]
        );
        
        console.log(`Found ${checkResult.rows.length} items in cart for user ${userId}`);
        
        if (checkResult.rows.length > 0) {
            console.log('Items to delete:');
            checkResult.rows.forEach(item => {
                console.log(`  - Cart ID: ${item.id}, Product ID: ${item.product_id}, Quantity: ${item.quantity}`);
            });
            
            // Delete all items from cart for this user
            const deleteResult = await pool.query(
                'DELETE FROM cart WHERE user_id = $1 RETURNING *',
                [userId]
            );
            
            console.log(`✅ Successfully deleted ${deleteResult.rowCount} items from cart`);
            
            // Verify deletion
            const verifyResult = await pool.query(
                'SELECT * FROM cart WHERE user_id = $1',
                [userId]
            );
            
            console.log(`After deletion, cart has ${verifyResult.rows.length} items`);
            
            res.json({ 
                success: true,
                message: 'Cart cleared successfully', 
                count: deleteResult.rowCount,
                deletedItems: deleteResult.rows
            });
        } else {
            console.log('Cart already empty');
            res.json({ 
                success: true,
                message: 'Cart already empty', 
                count: 0 
            });
        }
        
    } catch (error) {
        console.error('❌ Error clearing cart:', error);
        res.status(500).json({ 
            error: 'Failed to clear cart',
            details: error.message 
        });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
