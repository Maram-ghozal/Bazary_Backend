const mongoose = require('mongoose')
const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  amount: { type: Number, required: true },
  cardHolder: { type: String },
  cardLast4: { type: String },
  expiryDate: { type: String },
  status: { type: String, enum: ['SUCCESS', 'FAILED', 'PENDING'], default: 'PENDING' },
  purpose: { type: String, enum: ['BRAND_SUBSCRIPTION', 'BAZAAR_SUBSCRIPTION', 'ORDER_CHECKOUT'] },
  transactionId: { type: String, unique: true, sparse: true },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  bazaarId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bazaar',
    default: null
  },
 stripePaymentIntentId: { type: String, unique: true, sparse: true },
  pendingCredentials: {
    email: { type: String },
    tempPassword: { type: String },
  },
}, { timestamps: true })
module.exports = mongoose.model('Payment', paymentSchema)