const Stripe = require('stripe');
const Payment = require('../models/paymentModel');
const Bazaar = require('../models/bazaarModel');
const BazaarBrand = require('../models/bazaarBrandModel');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    // 1. Stripe بيتأكد إن الطلب جاي منه هو مش من حد تاني
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.log('Webhook signature failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 2. لو الدفع نجح
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;

        // بنجيب الـ Payment من الداتابيز عن طريق الـ stripePaymentIntentId
        const payment = await Payment.findOne({
            stripePaymentIntentId: paymentIntent.id
        });

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // بنحدث الـ Payment status
        payment.status = 'SUCCESS';
        await payment.save();

        // لو الدفع كان لبازار
        if (payment.purpose === 'BAZAAR_SUBSCRIPTION') {
            await Bazaar.findByIdAndUpdate(payment.bazaarId, {
                isPaid: true,
                status: 'UPCOMING'
            });
        }

        // لو الدفع كان لبراند
        if (payment.purpose === 'BRAND_SUBSCRIPTION') {
            await BazaarBrand.findOneAndUpdate(
                { paymentId: payment._id },
                {
                    status: 'APPROVED',
                    paidAt: new Date(),
                    paidAmount: payment.amount
                }
            );
        }
    }

    // 3. لو الدفع فشل
    if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;

        await Payment.findOneAndUpdate(
            { stripePaymentIntentId: paymentIntent.id },
            { status: 'FAILED' }
        );
    }

    res.json({ received: true });
};

module.exports = { handleStripeWebhook };