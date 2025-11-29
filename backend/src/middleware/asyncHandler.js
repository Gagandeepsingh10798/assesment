/**
 * Async Handler Middleware
 * Wraps async route handlers to catch errors and pass them to error middleware
 */

/**
 * Wrap an async function to automatically catch errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Wrap multiple middlewares with async handler
 * @param  {...Function} fns - Async functions to wrap
 * @returns {Function[]} Array of wrapped middleware functions
 */
const asyncHandlerAll = (...fns) => {
  return fns.map(fn => asyncHandler(fn));
};

export { asyncHandler, asyncHandlerAll };
export default asyncHandler;

