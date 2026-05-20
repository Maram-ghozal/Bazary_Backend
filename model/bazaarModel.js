const mongoose = require("mongoose");
const validator = require('validator');

const bazaarSchema = new mongoose.Schema({
    // Reference to the User who created the bazaar
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    fullName: { type: String, required: true },

    phone: { type: String, required: true },

    whatsapp: { type: String },

    email: { type: String, required: true,
         validate:[validator.isEmail,'Please provide a valid email']
     },

    bazaarName: { type: String, required: true },

    bazaarDescription: { type: String, maxlength: 500 },

    logoUrl: { type: String },

    address: { type: String },

    googleMapsLink: { type: String },

    startDate: { type: Date },

    endDate: { type: Date },

    status: { type: String, enum: ['UPCOMING', 'LIVE', 'ENDED'], default: 'UPCOMING' },

    priceOffline: { type: Number },

    priceOnline: { type: Number },

    priceHybrid: { type: Number },

    paymentMethod: { type: String },

    maxBrandCapacity: { type: Number, default: 50 },

    isAcceptingBrands: { type: Boolean, default: true },

    autoCloseOnFull: { type: Boolean, default: true },

    autoCloseBeforeEvent: { type: Boolean, default: false },


},
// Automatically add createdAt and updatedAt fields
 { timestamps: true });

module.exports = mongoose.model('Bazaar', bazaarSchema);
