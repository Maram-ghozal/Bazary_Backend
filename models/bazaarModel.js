const mongoose = require("mongoose");
const validator = require('validator');

const bazaarSchema = new mongoose.Schema({
  // Reference to the User who created the bazaar
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  fullName: { type: String, required: true },

  phone: { type: String, required: true },

  whatsapp: { type: String },

  bazaarName: { type: String, required: true },

  bazaarDescription: { type: String, maxlength: 500 },

  logoUrl: { type: String },
  backgroundImage: { type: String },
  type: { type: String, enum: ['OFFLINE', 'ONLINE', 'HYBRID'], required: true },
  packageId: { type: String, enum: ['STARTER', 'BUSINESS', 'PREMIUM'], required: true },
  topSearch: { type: Boolean, default: false },
  aiAssistant: { type: Boolean, default: false },
  paidAmount: { type: Number, default: 0 },
  priceOffline: { type: Number, default: 0 },
  priceOnline: { type: Number, default: 0 },
  priceHybrid: { type: Number, default: 0 },
  address: { type: String },

  googleMapsLink: { type: String },

  startDate: { type: Date },

  endDate: { type: Date },

  status: { type: String, enum: ['PENDING_PAYMENT', 'UPCOMING', 'LIVE', 'ENDED'], default: 'PENDING_PAYMENT' },
  isPaid: { type: Boolean, default: false },
  paymentMethod: { type: String },

  maxBrandCapacity: { type: Number, required: true },

  isAcceptingBrands: { type: Boolean, default: true },

  autoCloseOnFull: { type: Boolean, default: true },

  autoCloseBeforeEvent: { type: Boolean, default: false },
  socialMediaLinks: {
    type: [String],
    default: []
  }
},
  // Automatically add createdAt and updatedAt fields
  { timestamps: true });

module.exports = mongoose.model('Bazaar', bazaarSchema);
