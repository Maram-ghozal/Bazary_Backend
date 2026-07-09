const Joi = require('joi');

const createBazaarSchema = Joi.object({
    email: Joi.string().email().required(),
    fullName: Joi.string().required(),
    phone: Joi.string().required(),
    whatsapp: Joi.string().allow('', null),
    bazaarName: Joi.string().required(),
    bazaarDescription: Joi.string().max(500).allow('', null),
    logoUrl: Joi.string().uri().allow('', null),
    backgroundImage: Joi.string().uri().allow('', null),
    address: Joi.string().allow('', null),
    googleMapsLink: Joi.string().uri().allow('', null),
    startDate: Joi.date().iso().allow(null),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).allow(null),
    packageId: Joi.string().valid('STARTER', 'BUSINESS', 'PREMIUM').required(),
    socialMediaLinks: Joi.array().items(Joi.string().uri()).optional(),
    paymentMethod: Joi.string().allow('', null),
    isAcceptingBrands: Joi.boolean().allow(null),
    autoCloseOnFull: Joi.boolean().allow(null),
    autoCloseBeforeEvent: Joi.boolean().allow(null)
});

const updateBazaarSchema = Joi.object({
    email: Joi.string().email(),
    phone: Joi.string(),
    whatsapp: Joi.string().allow('', null),
    bazaarName: Joi.string(),
    bazaarDescription: Joi.string().max(500).allow('', null),
    logoUrl: Joi.string().uri().allow('', null),
    backgroundImage: Joi.string().uri().allow('', null),
socialMediaLinks: Joi.array().items(Joi.string().uri()).optional(),
    isAcceptingBrands: Joi.boolean(),
    autoCloseOnFull: Joi.boolean(),
    autoCloseBeforeEvent: Joi.boolean()
}).min(1);

module.exports = {
    createBazaarSchema,
    updateBazaarSchema
};