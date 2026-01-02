import { Server as IOServer } from 'socket.io';

let io: IOServer | null = null;

export function initSocket(server: any) {
  if (io) return io;
  io = new IOServer(server, {
    cors: {
      origin: 'http://localhost:3000',
      credentials: true,
    }
  });

  io.on('connection', (socket) => {
    console.log('[SOCKET] client connected', socket.id);
    socket.on('disconnect', () => console.log('[SOCKET] client disconnected', socket.id));
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
