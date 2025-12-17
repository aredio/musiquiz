import { Server, Socket } from 'socket.io';
import { GameManager, type GamePlayer } from './GameManager';
import os from 'os';

// Função para obter o endereço IP local
function getLocalIpAddress(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  Object.values(interfaces).forEach(iface => {
    if (iface) {
      iface.forEach(details => {
        // Ignora endereços não-IPv4 e endereços de loopback
        if (details.family === 'IPv4' && !details.internal) {
          addresses.push(details.address);
        }
      });
    }
  });

  return addresses;
}

// Função para exibir as URLs de acesso
export function logServerInfo(port: number): void {
  const localIps = getLocalIpAddress();
  
  console.log('\n=== Servidor rodando nas seguintes URLs ===');
  console.log(`Local:    http://localhost:${port}`);
  
  if (localIps.length > 0) {
    console.log('\nAcessível na rede local:');
    localIps.forEach(ip => {
      console.log(`- http://${ip}:${port}`);
    });
  } else {
    console.log('\nNão foi possível detectar o endereço IP local.');
  }
  
  console.log('\nUse o QR Code na tela do host para facilitar o acesso dos jogadores!');
  console.log('======================================\n');
}

// ==================== TIPOS E INTERFACES ====================

export type PlayerRole = 'host' | 'player';

export interface JoinGamePayload {
  name: string;
  role: PlayerRole;
  roomId?: string;
}

export interface BuzzPayload {
  roomId: string;
}

export interface GameStatePayload {
  roomId: string;
}

export interface UpdateScorePayload {
  roomId: string;
  playerId: string;
  points: number;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Emite o estado atual do jogo para todos na sala
 */
function emitGameState(io: Server, gameManager: GameManager, roomId: string): void {
  const room = gameManager.getRoom(roomId);
  if (!room) return;

  const players = gameManager.getPlayersInRoom(roomId);
  const gameState = {
    state: room.state,
    roundNumber: room.roundNumber,
    totalRounds: room.totalRounds,
    currentRound: room.currentRound,
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      avatar: p.avatar,
    })),
  };

  io.to(roomId).emit('game_state_update', gameState);
}

// ==================== INICIALIZAÇÃO DO SERVIDOR ====================

export function setupSocketServer(io: Server): void {
  const gameManager = new GameManager();

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ==================== EVENTO: join_game ====================
    socket.on('join_game', (payload: JoinGamePayload, callback?: (response: any) => void) => {
      try {
        let roomId: string;
        let player: GamePlayer;

        if (payload.role === 'host') {
          // Host cria uma nova sala ou entra em uma existente
          if (payload.roomId) {
            // Tentar entrar em sala existente
            const existingRoom = gameManager.getRoom(payload.roomId);
            if (existingRoom) {
              player = gameManager.addPlayer(socket.id, payload.name, payload.roomId);
              roomId = payload.roomId;
            } else {
              // Criar nova sala com o ID fornecido
              roomId = gameManager.createRoom(socket.id, payload.name, payload.roomId);
              player = gameManager.getPlayer(socket.id)!;
            }
          } else {
            // Criar nova sala com ID gerado
            roomId = gameManager.createRoom(socket.id, payload.name);
            player = gameManager.getPlayer(socket.id)!;
          }
        } else {
          // Player precisa de um roomId
          if (!payload.roomId) {
            throw new Error('Room ID is required for players');
          }
          player = gameManager.addPlayer(socket.id, payload.name, payload.roomId);
          roomId = payload.roomId;
        }

        // Entrar na sala do Socket.io
        socket.join(roomId);

        // Obter estado atual da sala
        const room = gameManager.getRoom(roomId)!;
        const players = gameManager.getPlayersInRoom(roomId);

        // Notificar o jogador que entrou
        if (callback) {
          callback({
            success: true,
            roomId: room.id,
            player: {
              id: player.id,
              name: player.name,
              score: player.score,
              avatar: player.avatar,
            },
            players: players.map(p => ({
              id: p.id,
              name: p.name,
              score: p.score,
              avatar: p.avatar,
            })),
            gameState: {
              state: room.state,
              roundNumber: room.roundNumber,
              totalRounds: room.totalRounds,
              currentRound: room.currentRound,
            },
          });
        }

        // Emitir estado atualizado para todos na sala
        emitGameState(io, gameManager, roomId);

        // Notificar outros jogadores na sala
        socket.to(roomId).emit('player_joined', {
          player: {
            id: player.id,
            name: player.name,
            score: player.score,
            avatar: player.avatar,
          },
          players: players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            avatar: p.avatar,
          })),
        });

        console.log(`[Socket] ${player.name} joined room ${roomId}`);
      } catch (error: any) {
        console.error(`[Socket] Error joining game:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    // ==================== EVENTO: start_game ====================
    socket.on('start_game', (payload: GameStatePayload, callback?: (response: any) => void) => {
      try {
        const player = gameManager.getPlayer(socket.id);
        if (!player) {
          throw new Error('Player not found');
        }

        const room = gameManager.getRoom(payload.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        // Verificar se é o host
        if (!gameManager.isHost(payload.roomId, socket.id)) {
          throw new Error('Only the host can start the game');
        }

        // Iniciar o jogo
        gameManager.startGame(payload.roomId);
        
        // Avançar para a primeira rodada
        gameManager.nextRound(payload.roomId);
        
        // Após um delay, iniciar a reprodução (ROUND_PLAYING)
        setTimeout(() => {
          gameManager.startRoundPlaying(payload.roomId);
          emitGameState(io, gameManager, payload.roomId);
        }, 2000); // 2 segundos de loading

        // Emitir estado atualizado
        emitGameState(io, gameManager, payload.roomId);

        if (callback) {
          callback({
            success: true,
            message: 'Game started',
          });
        }

        console.log(`[Socket] Game started in room ${payload.roomId}`);
      } catch (error: any) {
        console.error(`[Socket] Error starting game:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    // ==================== EVENTO: next_round ====================
    socket.on('next_round', (payload: GameStatePayload, callback?: (response: any) => void) => {
      try {
        const player = gameManager.getPlayer(socket.id);
        if (!player) {
          throw new Error('Player not found');
        }

        const room = gameManager.getRoom(payload.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        // Verificar se é o host
        if (!gameManager.isHost(payload.roomId, socket.id)) {
          throw new Error('Only the host can advance to next round');
        }

        // Avançar para próxima rodada
        gameManager.nextRound(payload.roomId);
        const roomAfter = gameManager.getRoom(payload.roomId)!;
        
        // Se o jogo acabou
        if (roomAfter.state === 'GAME_OVER') {
          emitGameState(io, gameManager, payload.roomId);
          if (callback) {
            callback({
              success: true,
              message: 'Game over',
            });
          }
          return;
        }

        // Após um delay, iniciar a reprodução (ROUND_PLAYING)
        setTimeout(() => {
          gameManager.startRoundPlaying(payload.roomId);
          emitGameState(io, gameManager, payload.roomId);
        }, 2000); // 2 segundos de loading

        // Emitir estado atualizado
        emitGameState(io, gameManager, payload.roomId);

        if (callback) {
          callback({
            success: true,
            message: 'Next round started',
          });
        }

        console.log(`[Socket] Next round started in room ${payload.roomId}`);
      } catch (error: any) {
        console.error(`[Socket] Error starting next round:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    // ==================== EVENTO: buzz ====================
    socket.on('buzz', (payload: BuzzPayload, callback?: (response: any) => void) => {
      try {
        const player = gameManager.getPlayer(socket.id);
        if (!player) {
          throw new Error('Player not found');
        }

        const wasFirst = gameManager.handleBuzz(payload.roomId, socket.id);

        if (wasFirst) {
          const buzzedPlayer = gameManager.getPlayer(socket.id)!;

          // Emitir estado atualizado
          emitGameState(io, gameManager, payload.roomId);

          // Notificar todos na sala que alguém buzou
          io.to(payload.roomId).emit('buzz_received', {
            playerId: socket.id,
            playerName: buzzedPlayer.name,
            timestamp: Date.now(),
          });

          if (callback) {
            callback({
              success: true,
              message: 'Buzz registered successfully',
            });
          }

          console.log(`[Socket] ${buzzedPlayer.name} buzzed first in room ${payload.roomId}`);
        } else {
          if (callback) {
            callback({
              success: false,
              message: 'Round already locked or invalid state',
            });
          }
        }
      } catch (error: any) {
        console.error(`[Socket] Error handling buzz:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    // ==================== EVENTO: show_result ====================
    socket.on('show_result', (payload: GameStatePayload, callback?: (response: any) => void) => {
      try {
        const player = gameManager.getPlayer(socket.id);
        if (!player) {
          throw new Error('Player not found');
        }

        const room = gameManager.getRoom(payload.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        // Verificar se é o host
        if (!gameManager.isHost(payload.roomId, socket.id)) {
          throw new Error('Only the host can show results');
        }

        // Mostrar resultado
        gameManager.showRoundResult(payload.roomId);

        // Emitir estado atualizado
        emitGameState(io, gameManager, payload.roomId);

        if (callback) {
          callback({
            success: true,
            message: 'Result shown',
          });
        }

        console.log(`[Socket] Result shown in room ${payload.roomId}`);
      } catch (error: any) {
        console.error(`[Socket] Error showing result:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    // ==================== EVENTO: update_score ====================
    socket.on('update_score', (payload: UpdateScorePayload, callback?: (response: any) => void) => {
      try {
        const player = gameManager.getPlayer(socket.id);
        if (!player) {
          throw new Error('Player not found');
        }

        const room = gameManager.getRoom(payload.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        // Verificar se é o host
        if (!gameManager.isHost(payload.roomId, socket.id)) {
          throw new Error('Only the host can update scores');
        }

        // Atualizar pontuação
        gameManager.updateScore(payload.roomId, payload.playerId, payload.points);

        // Emitir estado atualizado
        emitGameState(io, gameManager, payload.roomId);

        if (callback) {
          callback({
            success: true,
            message: 'Score updated',
          });
        }

        console.log(`[Socket] Score updated for player ${payload.playerId} in room ${payload.roomId}`);
      } catch (error: any) {
        console.error(`[Socket] Error updating score:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    // ==================== EVENTO: host_give_score (Karaokê) ====================
    socket.on('host_give_score', (payload: { roomId: string; playerId: string; scoreAmount: number }, callback?: (response: any) => void) => {
      try {
        const player = gameManager.getPlayer(socket.id);
        if (!player) {
          throw new Error('Player not found');
        }

        const room = gameManager.getRoom(payload.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        // Verificar se é o host
        if (!gameManager.isHost(payload.roomId, socket.id)) {
          throw new Error('Only the host can give scores');
        }

        // Verificar se é rodada de karaokê
        if (!room.currentRound?.isKaraoke) {
          throw new Error('This action is only available in karaoke rounds');
        }

        // Validar scoreAmount
        if (payload.scoreAmount < 0 || payload.scoreAmount > 10) {
          throw new Error('Score amount must be between 0 and 10');
        }

        // Dar pontuação
        gameManager.giveScore(payload.roomId, payload.playerId, payload.scoreAmount);

        // Emitir estado atualizado
        emitGameState(io, gameManager, payload.roomId);

        if (callback) {
          callback({
            success: true,
            message: 'Score given successfully',
          });
        }

        console.log(`[Socket] Host gave ${payload.scoreAmount} points to player ${payload.playerId} in room ${payload.roomId}`);
      } catch (error: any) {
        console.error(`[Socket] Error giving score:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    // ==================== EVENTO: reset_round (compatibilidade) ====================
    socket.on('reset_round', (payload: { roomId: string }, callback?: (response: any) => void) => {
      try {
        const player = gameManager.getPlayer(socket.id);
        if (!player) {
          throw new Error('Player not found');
        }

        const room = gameManager.getRoom(payload.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        // Verificar se é o host
        if (!gameManager.isHost(payload.roomId, socket.id)) {
          throw new Error('Only the host can reset the round');
        }

        // Resetar rodada (avança para próxima)
        gameManager.resetRound(payload.roomId);
        const roomAfter = gameManager.getRoom(payload.roomId)!;
        
        // Se o jogo acabou
        if (roomAfter.state === 'GAME_OVER') {
          emitGameState(io, gameManager, payload.roomId);
          if (callback) {
            callback({
              success: true,
              message: 'Game over',
            });
          }
          return;
        }

        // Após um delay, iniciar a reprodução (ROUND_PLAYING)
        setTimeout(() => {
          gameManager.startRoundPlaying(payload.roomId);
          emitGameState(io, gameManager, payload.roomId);
        }, 2000); // 2 segundos de loading

        // Emitir estado atualizado
        emitGameState(io, gameManager, payload.roomId);

        if (callback) {
          callback({
            success: true,
            message: 'Round reset successfully',
          });
        }

        console.log(`[Socket] Round reset by host in room ${payload.roomId}`);
      } catch (error: any) {
        console.error(`[Socket] Error resetting round:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    // ==================== EVENTO: disconnect ====================
    socket.on('disconnect', () => {
      const { room, player } = gameManager.removePlayer(socket.id);

      if (player && room) {
        // Emitir estado atualizado para os jogadores restantes
        emitGameState(io, gameManager, room.id);

        // Notificar outros jogadores na sala
        const remainingPlayers = gameManager.getPlayersInRoom(room.id);
        socket.to(room.id).emit('player_left', {
          playerId: socket.id,
          playerName: player.name,
          players: remainingPlayers.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            avatar: p.avatar,
          })),
        });

        console.log(`[Socket] ${player.name} left room ${room.id}`);
      }

      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });

    // ==================== EVENTO: get_room_state ====================
    socket.on('get_room_state', (payload: { roomId: string }, callback?: (response: any) => void) => {
      try {
        const room = gameManager.getRoom(payload.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        const players = gameManager.getPlayersInRoom(payload.roomId);
        const player = gameManager.getPlayer(socket.id);

        if (callback) {
          callback({
            success: true,
            gameState: {
              state: room.state,
              roundNumber: room.roundNumber,
              totalRounds: room.totalRounds,
              currentRound: room.currentRound,
            },
            players: players.map(p => ({
              id: p.id,
              name: p.name,
              score: p.score,
              avatar: p.avatar,
            })),
            currentPlayer: player ? {
              id: player.id,
              name: player.name,
              score: player.score,
              avatar: player.avatar,
            } : null,
          });
        }
      } catch (error: any) {
        console.error(`[Socket] Error getting room state:`, error.message);
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });
  });

  console.log('[Socket] Socket.io server configured with GameManager');
}
