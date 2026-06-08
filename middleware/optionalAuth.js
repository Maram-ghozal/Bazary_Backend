const jwt = require('jsonwebtoken');

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        req.user = null;
    }
    next();
};

module.exports = optionalAuth;