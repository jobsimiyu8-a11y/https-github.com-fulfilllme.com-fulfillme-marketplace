const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fulfillme',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
pool.getConnection()
    .then(connection => {
        console.log('Database connected successfully');
        connection.release();
    })
    .catch(err => {
        console.error('Database connection failed:', err);
    });

// Basic routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'FulfillME API is running' });
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, phone, fullName, location, nationalId, gender, userType } = req.body;
        
        // Check if user exists
        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE email = ? OR phone = ?',
            [email, phone]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Insert new user
        const [result] = await pool.execute(
            `INSERT INTO users (email, phone, full_name, location, national_id, gender, user_type) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [email, phone, fullName, location, nationalId, gender, userType]
        );
        
        res.json({
            success: true,
            userId: result.insertId,
            message: 'Registration successful'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Needs routes
app.get('/api/needs', async (req, res) => {
    try {
        const { category, location, limit = 20, offset = 0 } = req.query;
        
        let query = `
            SELECT n.*, u.full_name, u.gender 
            FROM needs n 
            JOIN users u ON n.user_id = u.id 
            WHERE n.status = 'active'
        `;
        let params = [];
        
        if (category) {
            query += ' AND n.category = ?';
            params.push(category);
        }
        
        if (location) {
            query += ' AND n.location = ?';
            params.push(location);
        }
        
        query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [needs] = await pool.execute(query, params);
        
        // Hide contact info for non-paying users
        const safeNeeds = needs.map(need => ({
            ...need,
            contact_methods: null,
            user_phone: null,
            user_email: null
        }));
        
        res.json(safeNeeds);
    } catch (error) {
        console.error('Get needs error:', error);
        res.status(500).json({ error: 'Failed to fetch needs' });
    }
});

app.post('/api/needs', async (req, res) => {
    try {
        const { userId, title, description, budget, location, category, contactMethods } = req.body;
        
        const [result] = await pool.execute(
            `INSERT INTO needs (user_id, title, description, budget, location, category, contact_methods) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, title, description, budget, location, category, JSON.stringify(contactMethods)]
        );
        
        res.json({
            success: true,
            needId: result.insertId,
            message: 'Need posted successfully'
        });
    } catch (error) {
        console.error('Post need error:', error);
        res.status(500).json({ error: 'Failed to post need' });
    }
});

// Payment routes
app.post('/api/payments/unlock', async (req, res) => {
    try {
        const { needId, fulfillerId, mpesaCode } = req.body;
        
        // Verify M-Pesa payment (simplified)
        const paymentVerified = await verifyMpesaPayment(mpesaCode, 100);
        
        if (!paymentVerified) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }
        
        // Record transaction
        await pool.execute(
            `INSERT INTO transactions (fulfiller_id, need_id, amount, status, mpesa_code) 
             VALUES (?, ?, ?, 'completed', ?)`,
            [fulfillerId, needId, 100, mpesaCode]
        );
        
        // Get contact info
        const [needs] = await pool.execute(
            `SELECT n.*, u.phone, u.email 
             FROM needs n 
             JOIN users u ON n.user_id = u.id 
             WHERE n.id = ?`,
            [needId]
        );
        
        if (needs.length === 0) {
            return res.status(404).json({ error: 'Need not found' });
        }
        
        const need = needs[0];
        
        res.json({
            success: true,
            contactInfo: {
                phone: need.phone,
                email: need.email,
                contactMethods: JSON.parse(need.contact_methods || '[]')
            }
        });
    } catch (error) {
        console.error('Unlock error:', error);
        res.status(500).json({ error: 'Failed to unlock contact' });
    }
});

// Helper function (simplified M-Pesa verification)
async function verifyMpesaPayment(mpesaCode, expectedAmount) {
    // In production, integrate with M-Pesa API
    // For now, simulate verification
    return mpesaCode && mpesaCode.startsWith('MPS');
}

// Start server
app.listen(PORT, () => {
    console.log(`FulfillME backend running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}/api`);
});