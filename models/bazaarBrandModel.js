const mongoose = require('mongoose');

const bazaarBrandSchema = new mongoose.Schema({

  bazaarId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar', required: true },

  brandId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Brand',  required: true },

  brandType:  { type: String, enum: ['OFFLINE', 'ONLINE', 'HYBRID'], default: 'OFFLINE' },

  status:     { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },

  paidAt:     { type: Date },

  paidAmount: { type: Number },
paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null
}

}, { timestamps: true });

// Ensure a brand can only be associated with a bazaar once
bazaarBrandSchema.index({ bazaarId: 1, brandId: 1 }, { unique: true });

module.exports = mongoose.model('BazaarBrand', bazaarBrandSchema);
