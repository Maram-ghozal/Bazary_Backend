const sharp = require("sharp");
const validateDimensions = (minWidth, minHeight, fieldName = null) => {
  return async (req, res, next) => {
    try {
      let fileToCheck = null;

      if (fieldName) {
        fileToCheck = req.files && req.files[fieldName] && req.files[fieldName][0];
      } else {
        fileToCheck = req.file || null;
      }

      if (!fileToCheck) {
        return next();
      }

      const metadata = await sharp(fileToCheck.buffer).metadata();

      if ( metadata.width < minWidth || metadata.height < minHeight) {
        return res.status(400).json({
          message: `Image must be at least ${minWidth}x${minHeight}px`
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = validateDimensions;