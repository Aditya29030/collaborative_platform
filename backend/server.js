// server.js
// This is the entry point — running `node server.js` (or `npm run dev`)
// starts everything: the Express HTTP server, the MongoDB connection,
// and the Socket.io real-time server, all attached to one port.

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const registerCollabHandlers = require('./sockets/collabHandler');

const app = express();

// --- Middleware ---
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json()); // lets us read JSON request bodies (req.body)

// --- Database ---
connectDB();

// --- REST API routes ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// --- HTTP + Socket.io server ---
// We wrap the Express app in a raw http server because Socket.io needs
// to attach itself to the same underlying server (it can't just bolt
// onto Express directly).
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || '*' },
});

registerCollabHandlers(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
