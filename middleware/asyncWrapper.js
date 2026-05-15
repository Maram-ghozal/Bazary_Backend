module.exports = (asyncFn) => {
    //return a new function that wraps the async function and catches any errors
    return (req, res, next) => {
        //call the async function and catch any errors that occur, passing them to the next middleware
        asyncFn(req, res, next).catch(err => next(err));
    }
}