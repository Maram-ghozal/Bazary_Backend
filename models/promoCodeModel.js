const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true 
  },
  discountPercentage: { 
    type: Number, 
    required: true,
    enum: [5, 10, 15, 20, 25, 30, 50]
  },
  isActive: { type: Boolean, default: true },
  usedBy: [{
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    usedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

promoCodeSchema.statics.getRandomPromo = async function() {
  const weights = { 5: 25, 10: 25, 15: 20, 20: 15, 25: 10, 30: 3, 50: 2 };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  
  let random = Math.random() * totalWeight;

  for (const [perc, weight] of Object.entries(weights)) {
    if (random < weight) {
      const discount = parseInt(perc);
      const code = `BAZARY${discount}OFF${Math.floor(100000 + Math.random() * 900000)}`;
      
      return await this.create({
        code,
        discountPercentage: discount,
        isActive: true
      });
    }
    random -= weight;
  }
};

module.exports = mongoose.model('PromoCode', promoCodeSchema);