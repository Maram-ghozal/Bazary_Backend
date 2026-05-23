const jwt = require ('jsonwebtoken')
const generateToken =(payload)=>{
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });

    // 2. عقد الإيجار (طويل العمر)
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN
    });
    return { accessToken, refreshToken };
}
module.exports = generateToken;