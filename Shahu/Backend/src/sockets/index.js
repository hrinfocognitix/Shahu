const { Server } = require('socket.io');
const env = require('../config/env');

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (env.isAllowedClientOrigin(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
      },
      credentials: true
    }
  });

  io.on('connection', socket => {
    socket.emit('connected', { socketId: socket.id });
  });

  return io;
}

module.exports = initSocket;
