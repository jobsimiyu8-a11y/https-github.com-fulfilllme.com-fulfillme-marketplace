const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    need: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Need'
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    type: {
        type: String,
        enum: ['unlock', 'credit_purchase', 'job_completed', 'refund'],
        required: true
    },
    mpesaCode: String,
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date
});

module.exports = mongoose.model('Transaction', transactionSchema);