const Joi = require("joi");

const createProductReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),

  comment: Joi.string().max(500).optional(),
});

const updateProductReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).optional(),

  comment: Joi.string().max(500).optional(),
}).min(1); 

module.exports={
    createProductReviewSchema,
    updateProductReviewSchema
}