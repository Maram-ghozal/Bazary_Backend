const sharp = require("sharp");

const validateDimensions = (minWidth, minHeight) => {
  return async (req, res, next) => {

    if (!req.file) {
      return next();
    }

    const metadata = await sharp(req.file.buffer).metadata();

    if (
      metadata.width < minWidth ||
      metadata.height < minHeight
    ) {
      return res.status(400).json({
        message: `Image must be at least ${minWidth}x${minHeight}px`
      });
    }

    next();
  };
};

module.exports = validateDimensions;