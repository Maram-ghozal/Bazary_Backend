const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: true,
    },
    name:            { type: String, required: true, trim: true },
    description:     { type: String },
    quantity:        { type: Number, required: true, default: 0, min: 0 },
    price:           { type: Number, required: true, min: 0 },
    priceAfterOffer: { type: Number, default: null, min: 0 },
    images:          [{ type: String }],
    viewsCount:      { type: Number, default: 0, min: 0 },
    isActive:        { type: Boolean, default: true },
    blockReason:     { type: String, default: null, trim: true },
    blockedAt:       { type: Date, default: null },
    blockedBy:       {
      type: String,
      enum: ['ADMIN', null],
      default: null,
    },
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);
module.exports = Product;