/**
 * Sanitizes incoming client headers.
 * Strips internal identity headers (e.g. x-user-id, x-user-role) that may be spoofed
 * by untrusted external clients. These headers will only be injected by the API Gateway
 * after authenticating the request.
 */
const sanitizeHeaders = (req, res, next) => {
    // Delete any spoofed internal headers provided by client
    delete req.headers["x-user-id"];
    delete req.headers["x-user-role"];
    delete req.headers["x-user-email"];

    next();
};

export { sanitizeHeaders };
export default sanitizeHeaders;
