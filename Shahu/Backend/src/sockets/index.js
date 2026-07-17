const { Server } = require('socket.io');
const env = require('../config/env');

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: env.clientOrigin,
      credentials: true
    }
  });

  io.on('connection', socket => {
    socket.emit('connected', { socketId: socket.id });
  });

  return io;
}

module.exports = initSocket;
