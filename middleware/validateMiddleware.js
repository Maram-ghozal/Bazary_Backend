const AppError = require("../utils/appError");

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new AppError(400, messages);
    }
    next();
  };
};
module.exports = validate;