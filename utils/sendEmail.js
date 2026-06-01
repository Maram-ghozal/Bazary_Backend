const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USERNAME, // الإيميل اللي هيبعت الرسايل
            pass: process.env.EMAIL_PASSWORD  // الباسورد الخاص بالتطبيقات (مش الباسورد العادي)
        }
    });

    // 2. تحديد تفاصيل الجواب (الرسالة)
    const mailOptions = {
        from: 'Bazaary App <no-reply@bazaary.com>', // اسم المرسل اللي هيظهر للعميل
        to: options.email, // إيميل العميل اللي هنبعتله (هنجيبه من الكنترولر)
        subject: options.subject, // عنوان الرسالة
        text: options.message, // محتوى الرسالة نفسه
        
    };

    // 3. إرسال الرسالة فعلياً
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;