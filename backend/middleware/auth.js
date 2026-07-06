// middleware/auth.js
// This function acts as a "gatekeeper" for protected routes.
// It runs BEFORE the actual route handler and checks that a valid JWT
// was sent in the request headers. If not, it blocks the request.

const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  // Expect header format: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify checks the token's signature AND expiry using our secret key.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach decoded payload ({ id, name }) to the request
    next(); // token is valid — let the request continue to the actual route
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
};

module.exports = { protect };
