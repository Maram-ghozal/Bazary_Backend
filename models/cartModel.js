const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  brandId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Brand', 
    required: true 
  },
  bazaarId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Bazaar', 
    required: true 
  },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },           
}, { _id: false });

const cartSchema = new mongoose.Schema({
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  items: [cartItemSchema],
  totalAmount: { type: Number, default: 0 }
}, { timestamps: true });

cartSchema.pre('save', function() {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
});

module.exports = mongoose.model('Cart', cartSchema);