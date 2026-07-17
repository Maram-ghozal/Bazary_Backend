const nodemailer = require('nodemailer');

// بنعمل transporter واحد بس ونعيد استخدامه، بدل ما نفتح اتصال SMTP جديد
// (handshake + auth) في كل مرة بنبعت فيها إيميل. ده كان بياخد ثواني إضافية
// في كل استدعاء ويبطئ أي flow بيستنى الإيميل يخلص (زي الـ Stripe webhook).
let transporter = null;

const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USERNAME, // الإيميل اللي هيبعت الرسايل
                pass: process.env.EMAIL_PASSWORD  // الباسورد الخاص بالتطبيقات (مش الباسورد العادي)
            }
        });
    }
    return transporter;
};

const sendEmail = async (options) => {
    // 2. تحديد تفاصيل الجواب (الرسالة)
    const mailOptions = {
        from: 'Bazaary App <no-reply@bazaary.com>', // اسم المرسل اللي هيظهر للعميل
        to: options.email, // إيميل العميل اللي هنبعتله (هنجيبه من الكنترولر)
        subject: options.subject, // عنوان الرسالة
        text: options.message, // محتوى الرسالة نفسه
        
    };

    // 3. إرسال الرسالة فعلياً
    await getTransporter().sendMail(mailOptions);
};

module.exports = sendEmail;