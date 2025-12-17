import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketServer, logServerInfo } from './server';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'MusicParty Server is running' });
});

// Configurar Socket.io com a estrutura de salas e eventos
setupSocketServer(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 MusicParty Server running on port ${PORT}`);
  // Mostra os IPs locais para acesso em rede
  const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  logServerInfo(portNumber);
});

