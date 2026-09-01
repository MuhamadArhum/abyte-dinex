// requestId.js - Injects unique X-Request-ID per HTTP request
// Sets req.requestId and propagates it in the response header.
// The logger reads from AsyncLocalStorage so every log line inside
// a request handler automatically includes the requestId.

const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const requestStorage = new AsyncLocalStorage();

const requestIdMiddleware = (req, res, next) => {
  const id = req.headers['x-request-id'] || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  requestStorage.run({ requestId: id }, next);
};

const getRequestId = () => requestStorage.getStore()?.requestId || null;

module.exports = { requestIdMiddleware, getRequestId };
