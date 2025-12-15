const mongoose = require('mongoose');

const needSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    budget: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true,
        enum: ['services', 'products', 'rentals', 'pets', 'transport', 'other']
    },
    subcategory: String,
    location: {
        type: String,
        required: true
    },
    timeframe: {
        type: String,
        enum: ['asap', 'today', 'tomorrow', 'week', 'month', 'flexible'],
        default: 'flexible'
    },
    status: {
        type: String,
        enum: ['active', 'fulfilled', 'expired', 'cancelled'],
        default: 'active'
    },
    photo: String,
    contactMethods: [{
        type: String,
        enum: ['whatsapp', 'sms', 'call', 'email']
    }],
    unlockedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    offers: [{
        fulfiller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        amount: Number,
        message: String,
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    selectedFulfiller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isUrgent: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        default: () => new Date(+new Date() + 30*24*60*60*1000) // 30 days from now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
needSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Auto-expire needs
needSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Need', needSchema);