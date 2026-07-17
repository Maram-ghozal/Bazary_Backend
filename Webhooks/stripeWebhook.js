const Stripe = require('stripe');
const Payment = require('../models/paymentModel');
const Bazaar = require('../models/bazaarModel');
const BazaarBrand = require('../models/bazaarBrandModel');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const WaitingList = require('../models/waitingListModel');
const { createBrandFromWaitingList } = require('../utils/helperRegisterBrand');
const sendEmail = require('../utils/sendEmail');
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
        try {
            const paymentIntent = event.data.object;
            const orderId = paymentIntent.metadata?.orderId;

            const payment = await Payment.findOne({
                stripePaymentIntentId: paymentIntent.id
            });

            if (payment) {
                payment.status = 'SUCCESS';
                await payment.save();

                if (payment.purpose === 'BAZAAR_SUBSCRIPTION') {
                    await Bazaar.findByIdAndUpdate(payment.bazaarId, {
                        isPaid: true,
                        status: 'UPCOMING'
                    });

                    // ✅ لو فيه بيانات دخول متخزنة (يوزر جديد)، ابعتها دلوقتي بعد نجاح الدفع فعلاً
                    // ملاحظة: بنبعت الإيميل من غير await عشان الـ webhook يكمل ويرد بسرعة
                    // على Stripe، ومايفضلش الدفع "معلق" لحد ما الإيميل يخلص إرسال.
                    if (payment.pendingCredentials && payment.pendingCredentials.email) {
                        const { email: credentialsEmail, tempPassword } = payment.pendingCredentials;

                        sendEmail({
                            email: credentialsEmail,
                            subject: "Your Bazaary Account Details",
                            message: `
                                Welcome to Bazaary! 🎉
                                Your payment was successful and your account is ready.
                                Email: ${credentialsEmail}
                                Password: ${tempPassword}
                                Please log in and change your password as soon as possible.
                            `,
                        })
                            .catch((error) => {
                                console.error("Error sending password email:", error);
                            })
                            .finally(async () => {
                                // بنمسح الباسورد المؤقت من الداتابيز بعد محاولة الإرسال
                                await Payment.findByIdAndUpdate(payment._id, {
                                    $unset: { pendingCredentials: 1 },
                                });
                            });
                    }
                }

            
if (payment.purpose === 'BRAND_SUBSCRIPTION') {
    const waitingListId = paymentIntent.metadata.waitingListId;
    const entry = await WaitingList.findById(waitingListId);
    if (entry) {
        await createBrandFromWaitingList(entry, payment._id);
        entry.status = 'APPROVED';
        await entry.save();
    }
}
            }

            if (orderId) {
                const order = await Order.findById(orderId);
                if (order) {
                    for (const item of order.items) {
                        await Product.findByIdAndUpdate(item.productId, {
                            $inc: { quantity: -item.quantity }
                        });
                    }
                    order.status = 'PREPARING';
                    await order.save();
                }
            }

        } catch (err) {
            console.error('Webhook error:', err.message);
            return res.status(500).json({ message: err.message });
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