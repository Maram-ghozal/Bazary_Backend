const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    // bazaarId: {                          
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'Bazaar',
    //   required: true,
    // },
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    phone:     { type: String, required: true, trim: true },
    whatsapp:  { type: String, trim: true },
    email:     { type: String, required: true, trim: true },
    brandName:        { type: String, required: true, trim: true },
    brandCategory:    { type: String, trim: true },
    brandDescription: { type: String},
    logoUrl:          { type: String },
    brandType: { type: String, enum: ['OFFLINE', 'ONLINE', 'HYBRID'],required: true},
    location: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Brand = mongoose.model('Brand', brandSchema);
module.exports = Brand;