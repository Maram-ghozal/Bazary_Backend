const Bazaar=require('../models/bazaarModel');

const syncBazaarStatus = async (now) => {
    await Bazaar.updateMany(
        {
            startDate: { $lte: now },
            endDate: { $gte: now }
        },
        { $set: { status: "LIVE" } }
    );

    await Bazaar.updateMany(
        {
            startDate: { $gt: now }
        },
        { $set: { status: "UPCOMING" } }
    );

    await Bazaar.updateMany(
        {
            endDate: { $lt: now }
        },
        { $set: { status: "ENDED" } }
    );
};

module.exports=syncBazaarStatus;