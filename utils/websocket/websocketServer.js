import { WebSocket, WebSocketServer } from 'ws';

class WebSocketService {
  constructor() {
    this.clients = new Map();
  }

  initialize(server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, req) => {
      // Extract userId from query parameters
      const userId = new URL(req.url, 'ws://localhost').searchParams.get('userId');
      if (userId) {
        this.clients.set(ws, userId);

        // Send initial connection success message
        ws.send(JSON.stringify({
          event: 'connection_established',
          data: { userId }
        }));
      }

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  // Broadcast to all clients
  broadcast(event, data) {
    const message = JSON.stringify({ event, data });
    this.clients.forEach((_, client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Send to specific user
  sendToUser(userId, event, data) {
    const message = JSON.stringify({ event, data });
    this.clients.forEach((clientUserId, client) => {
      if (clientUserId === userId && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// Change the export to use ES module syntax
const websocketService = new WebSocketService();
export { websocketService };
