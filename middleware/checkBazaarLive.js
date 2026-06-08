const Bazaar = require('../models/bazaarModel');
const httpStatusText = require('../utils/httpStatusText');
const appError = require('../utils/appError');

const checkBazaarLive = async (req, res, next) => {
    const { bazaarId } = req.params;
    const bazaar = await Bazaar.findById(bazaarId);

    if (!bazaar) {
        const error = appError.createError("bazaar not found", 404, httpStatusText.FAIL);
        return next(error);
    }

    const now = new Date();

    if (!(bazaar.startDate <= now && now <= bazaar.endDate)) {
        const error = appError.createError("bazaar not live", 403, httpStatusText.FAIL);
        return next(error);
    }

    req.bazaar = bazaar;
    next();
};

module.exports = checkBazaarLive;