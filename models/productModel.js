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
    // لو فيه أوفر — السعر بعد الخصم، لو مفيش أوفر مش محتاجة تبعته
    priceAfterOffer: { type: Number, default: null, min: 0 },
    images:          [{ type: String }],
    isActive:        { type: Boolean, default: true },
  },
  { timestamps: true }
);

// مش هيسمح بأوفر أعلى من السعر الأصلي
productSchema.pre('save', function (next) {
  if (this.priceAfterOffer !== null && this.priceAfterOffer >= this.price) {
    return next(new Error('priceAfterOffer must be less than price'));
  }
  next();
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;