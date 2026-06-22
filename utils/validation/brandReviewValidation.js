const Joi = require("joi");

const createBrandReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
});

const updateBrandReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).optional(),
}).min(1);

module.exports={
    createBrandReviewSchema,
    updateBrandReviewSchema
}