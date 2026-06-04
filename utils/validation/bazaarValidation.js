const Joi = require('joi');

const createBazaarSchema = Joi.object({
    email: Joi.string().email().required(),
    fullName: Joi.string().required(),
    phone: Joi.string().required(),
    whatsapp: Joi.string().allow('', null),
    bazaarName: Joi.string().required(),
    type: Joi.string().valid('OFFLINE', 'ONLINE', 'HYBRID').required(),
    bazaarDescription: Joi.string().max(500).allow('', null),
    logoUrl: Joi.string().uri().allow('', null),
    address: Joi.string().allow('', null),
    googleMapsLink: Joi.string().uri().allow('', null),
    startDate: Joi.date().iso().allow(null),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).allow(null),
    priceOffline: Joi.number().min(0).allow(null),
    priceOnline: Joi.number().min(0).allow(null),
    priceHybrid: Joi.number().min(0).allow(null),
    paymentMethod: Joi.string().allow('', null),
    maxBrandCapacity: Joi.number().min(1).allow(null),
    isAcceptingBrands: Joi.boolean().allow(null),
    autoCloseOnFull: Joi.boolean().allow(null),
    autoCloseBeforeEvent: Joi.boolean().allow(null)
});

module.exports = {
    createBazaarSchema
};