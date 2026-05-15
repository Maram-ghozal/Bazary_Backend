// define a custom error class that extends the built-in Error class
class AppError extends Error {
    constructor() {
        super();
    }

    // method to create an error object with message, status code, and status text
    createError(message, statusCode, statusText) {
        this.message = message;
        this.statusCode = statusCode;
        this.statusText = statusText;
        return this;
    }
}
// export an instance of AppError class to be used in other parts of the application
module.exports = new AppError();