const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true,
  },
  bazaarId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bazaar',
    required: true,
  },
}, { _id: false });

const wishlistSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  guestId: {
    type: String,
  },
  items: [wishlistItemSchema],
}, { timestamps: true });

wishlistSchema.index({ customerId: 1 }, { unique: true, sparse: true });
wishlistSchema.index({ guestId: 1 },   { unique: true, sparse: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);