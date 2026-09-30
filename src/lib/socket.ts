import { io, type Socket } from 'socket.io-client';
import { getToken } from './auth';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      // Evaluated on every (re)connect so a fresh token is used.
      auth: (cb) => cb({ token: getToken() }),
      transports: ['websocket'],
      reconnectionDelayMax: 10_000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
