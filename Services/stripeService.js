const Stripe = require('stripe');
const Payment = require('../models/paymentModel');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const createStripePayment = async ({ userId, bazaarId, amount, purpose, metadata = {} }) => {


    // 1. بنعمل PaymentIntent في Stripe الأول
    
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // Stripe بيشتغل بالقروش مش الجنيه
        currency: 'egp',
        metadata: {
           userId: userId ? userId.toString() : '',
            bazaarId: bazaarId ? bazaarId.toString() : '',
            purpose,
            ...metadata
        }
    })
    // 2. بنحفظ Payment في الداتابيز
    const payment = await Payment.create({
    userId: userId || null,
    bazaarId: bazaarId || null,
    amount: amount,
    purpose: purpose,
    status: 'PENDING',
    stripePaymentIntentId: paymentIntent.id
});

    // 3. بنرجع الـ paymentId والـ clientSecret للـ controller
    return {
        paymentId: payment._id,
        clientSecret: paymentIntent.client_secret,
    };
};

module.exports = { createStripePayment };