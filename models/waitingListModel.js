const mongoose = require('mongoose');

const waitingListSchema = new mongoose.Schema({
    bazaarId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Bazaar', 
        required: true 
    },
    // بيانات البراند
    email:            { type: String, required: true },
    firstName:        { type: String, required: true },
    lastName:         { type: String, required: true },
    phone:            { type: String, required: true },
    whatsapp:         { type: String },
    brandName:        { type: String, required: true },
    brandCategory:    { type: String },
    brandDescription: { type: String },
    logoUrl:          { type: String },
    backgroundImage:  { type: String },
    location:         { type: String },
    brandType: { 
        type: String, 
        enum: ['OFFLINE', 'ONLINE', 'HYBRID'], 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['PENDING', 'AWAITING_PAYMENT', 'APPROVED', 'REJECTED'], 
        default: 'PENDING' 
    },
    paymentLink: { type: String },
socialMediaLinks: {
  type: [String],
default:[] }

}, { timestamps: true });

//  نفس الإيميل في نفس البازار مرة واحدة بس
waitingListSchema.index({ bazaarId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('WaitingList', waitingListSchema);