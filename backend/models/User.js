const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other', 'prefer-not-to-say'],
        required: true
    },
    role: {
        type: String,
        enum: ['asker', 'fulfiller'],
        required: true
    },
    nationalId: {
        type: String,
        sparse: true
    },
    categories: [{
        type: String
    }],
    description: String,
    credits: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        default: 5.0,
        min: 0,
        max: 5
    },
    totalRatings: {
        type: Number,
        default: 0
    },
    completedJobs: {
        type: Number,
        default: 0
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    profilePhoto: String,
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
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('User', userSchema);