const AppError = require("../utils/appError");
const httpStatus = require("../utils/httpStatusText");
const validate = (schema) => {
  return (req, res, next) => {
    const { error,value } = schema.validate(req.body, { abortEarly: false ,convert: true });
    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      const err = AppError.createError(messages, 400, httpStatus.FAIL);
      return next(err);

    }
    req.body = value || req.body; 
    next();
  };
};
module.exports = validate;