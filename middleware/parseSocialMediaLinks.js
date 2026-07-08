const parseSocialMediaLinks = (req, res, next) => {
    const value = req.body.socialMediaLinks;

    if (value === undefined || value === null || value === "") {
        return next();
    }
    if (Array.isArray(value)) {
        return next();
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.startsWith("[")) {
            try {
                const parsed = JSON.parse(trimmed);
                req.body.socialMediaLinks = Array.isArray(parsed) ? parsed : [trimmed];
            } catch (err) {
                req.body.socialMediaLinks = [trimmed]; // fallback لو الـ JSON مكسور
            }
        } else {

            req.body.socialMediaLinks = [trimmed];
        }
    }

    next();
};

module.exports = parseSocialMediaLinks;