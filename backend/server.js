const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: ['https://jobsimiyu8-a11y.github.io', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fulfillme', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// Models
const User = require('./models/User');
const Need = require('./models/Need');
const Transaction = require('./models/Transaction');

// Authentication middleware
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

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'FulfillME API is running' });
});

// User Registration
app.post('/api/auth/register', [
    body('email').isEmail().normalizeEmail(),
    body('phone').isMobilePhone(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['asker', 'fulfiller'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { email, phone, password, role, fullName, location, gender } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = new User({
            email,
            phone,
            password: hashedPassword,
            role,
            fullName,
            location,
            gender,
            credits: role === 'fulfiller' ? 0 : null,
            rating: 5.0,
            createdAt: new Date()
        });
        
        await user.save();
        
        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                phone: user.phone,
                role: user.role,
                fullName: user.fullName,
                location: user.location,
                credits: user.credits,
                rating: user.rating
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ 
            $or: [{ email }, { phone: email }] 
        });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                phone: user.phone,
                role: user.role,
                fullName: user.fullName,
                location: user.location,
                credits: user.credits,
                rating: user.rating
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get User Profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ success: true, user });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Post a Need
app.post('/api/needs', authenticateToken, [
    body('title').notEmpty().trim().escape(),
    body('description').notEmpty().trim().escape(),
    body('budget').isNumeric(),
    body('category').notEmpty(),
    body('location').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { title, description, budget, category, location, timeframe, photo } = req.body;
        
        // Check if user is an asker
        const user = await User.findById(req.user.userId);
        if (user.role !== 'asker') {
            return res.status(403).json({ error: 'Only askers can post needs' });
        }
        
        // Create need
        const need = new Need({
            user: req.user.userId,
            title,
            description,
            budget,
            category,
            location,
            timeframe,
            photo,
            status: 'active',
            createdAt: new Date()
        });
        
        await need.save();
        
        res.status(201).json({
            success: true,
            need: {
                id: need._id,
                title: need.title,
                description: need.description,
                budget: need.budget,
                category: need.category,
                location: need.location,
                status: need.status,
                createdAt: need.createdAt
            }
        });
    } catch (error) {
        console.error('Post need error:', error);
        res.status(500).json({ error: 'Failed to post need' });
    }
});

// Get Needs (Browse)
app.get('/api/needs', async (req, res) => {
    try {
        const { 
            category, 
            location, 
            minBudget, 
            maxBudget, 
            sort = 'newest',
            page = 1,
            limit = 10 
        } = req.query;
        
        // Build query
        let query = { status: 'active' };
        
        if (category) query.category = category;
        if (location) query.location = { $regex: location, $options: 'i' };
        if (minBudget || maxBudget) {
            query.budget = {};
            if (minBudget) query.budget.$gte = parseFloat(minBudget);
            if (maxBudget) query.budget.$lte = parseFloat(maxBudget);
        }
        
        // Build sort
        let sortOption = { createdAt: -1 };
        if (sort === 'budget_high') sortOption = { budget: -1 };
        if (sort === 'budget_low') sortOption = { budget: 1 };
        if (sort === 'urgent') sortOption = { timeframe: 1, createdAt: -1 };
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Execute query
        const needs = await Need.find(query)
            .populate('user', 'fullName location rating')
            .sort(sortOption)
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Need.countDocuments(query);
        
        res.json({
            success: true,
            needs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get needs error:', error);
        res.status(500).json({ error: 'Failed to fetch needs' });
    }
});

// Get Single Need
app.get('/api/needs/:id', async (req, res) => {
    try {
        const need = await Need.findById(req.params.id)
            .populate('user', 'fullName location rating createdAt');
        
        if (!need) {
            return res.status(404).json({ error: 'Need not found' });
        }
        
        res.json({ success: true, need });
    } catch (error) {
        console.error('Get need error:', error);
        res.status(500).json({ error: 'Failed to fetch need' });
    }
});

// Unlock Contact (Fulfiller pays KSh 100)
app.post('/api/needs/:id/unlock', authenticateToken, async (req, res) => {
    try {
        const need = await Need.findById(req.params.id);
        if (!need) {
            return res.status(404).json({ error: 'Need not found' });
        }
        
        const user = await User.findById(req.user.userId);
        
        // Check if user is a fulfiller
        if (user.role !== 'fulfiller') {
            return res.status(403).json({ error: 'Only fulfillers can unlock needs' });
        }
        
        // Check if already unlocked
        if (need.unlockedBy.includes(req.user.userId)) {
            return res.status(400).json({ error: 'Already unlocked this need' });
        }
        
        // Check if user has enough credits
        if (user.credits < 1) {
            return res.status(400).json({ error: 'Insufficient credits. Please add credits first.' });
        }
        
        // Deduct credit and unlock
        user.credits -= 1;
        need.unlockedBy.push(req.user.userId);
        
        await user.save();
        await need.save();
        
        // Record transaction
        const transaction = new Transaction({
            user: req.user.userId,
            need: need._id,
            amount: 100,
            type: 'unlock',
            status: 'completed',
            createdAt: new Date()
        });
        
        await transaction.save();
        
        // Get asker contact info (without sensitive data)
        const asker = await User.findById(need.user).select('fullName phone email location rating');
        
        res.json({
            success: true,
            message: 'Need unlocked successfully',
            contactInfo: {
                fullName: asker.fullName,
                phone: asker.phone,
                email: asker.email,
                location: asker.location,
                rating: asker.rating
            }
        });
    } catch (error) {
        console.error('Unlock need error:', error);
        res.status(500).json({ error: 'Failed to unlock need' });
    }
});

// Add Credits (M-Pesa Integration)
app.post('/api/credits/add', authenticateToken, async (req, res) => {
    try {
        const { amount, mpesaCode } = req.body;
        const user = await User.findById(req.user.userId);
        
        // Validate M-Pesa code (in production, integrate with M-Pesa API)
        if (!mpesaCode || !mpesaCode.startsWith('MPS')) {
            return res.status(400).json({ error: 'Invalid M-Pesa code' });
        }
        
        // Calculate credits (KSh 100 = 1 credit)
        const credits = amount / 100;
        
        // Add credits
        user.credits += credits;
        await user.save();
        
        // Record transaction
        const transaction = new Transaction({
            user: req.user.userId,
            amount: amount,
            mpesaCode: mpesaCode,
            type: 'credit_purchase',
            status: 'completed',
            createdAt: new Date()
        });
        
        await transaction.save();
        
        res.json({
            success: true,
            message: `Added ${credits} credits to your account`,
            credits: user.credits
        });
    } catch (error) {
        console.error('Add credits error:', error);
        res.status(500).json({ error: 'Failed to add credits' });
    }
});

// Get Dashboard Stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        
        let stats = {};
        
        if (user.role === 'asker') {
            // Asker stats
            const activeNeeds = await Need.countDocuments({ 
                user: req.user.userId, 
                status: 'active' 
            });
            
            const completedNeeds = await Need.countDocuments({ 
                user: req.user.userId, 
                status: 'completed' 
            });
            
            const totalOffers = await Transaction.countDocuments({
                need: { $in: await Need.find({ user: req.user.userId }).distinct('_id') },
                type: 'unlock'
            });
            
            stats = {
                activeNeeds,
                completedNeeds,
                totalOffers,
                totalSpent: 0 // Calculate from completed needs
            };
        } else {
            // Fulfiller stats
            const unlockedNeeds = await Need.countDocuments({
                unlockedBy: req.user.userId
            });
            
            const completedJobs = await Transaction.countDocuments({
                user: req.user.userId,
                type: 'job_completed'
            });
            
            const totalEarned = await Transaction.aggregate([
                { $match: { user: req.user.userId, type: 'job_completed', status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            
            stats = {
                unlockedNeeds,
                completedJobs,
                totalEarned: totalEarned[0]?.total || 0,
                credits: user.credits
            };
        }
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`FulfillME backend running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}/api`);
});

module.exports = app;