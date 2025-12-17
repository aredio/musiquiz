import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore, type GameStateData } from '../store/gameStore';
import type {
  Player,
  Room,
  JoinGamePayload,
  JoinGameResponse,
  BuzzPayload,
  BuzzResponse,
  ResetRoundPayload,
  ResetRoundResponse,
  BuzzReceivedEvent,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  RoundResetEvent,
} from '../types/socket';

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  room: Room | null;
  currentPlayer: Player | null;
  players: Player[];
  isLocked: boolean;
  buzzedPlayerId: string | null;
  joinGame: (payload: JoinGamePayload) => Promise<JoinGameResponse>;
  buzz: (payload: BuzzPayload) => Promise<BuzzResponse>;
  resetRound: (payload: ResetRoundPayload) => Promise<ResetRoundResponse>;
}

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [buzzedPlayerId, setBuzzedPlayerId] = useState<string | null>(null);

  // Zustand store
  const { setGameState, setCurrentPlayer: setStorePlayer, setRoomId, setConnected: setStoreConnected } = useGameStore();

  useEffect(() => {
    const newSocket = io('http://localhost:3000', {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setStoreConnected(true);
      console.log('[Socket] Connected to server');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      setStoreConnected(false);
      console.log('[Socket] Disconnected from server');
    });

    // Evento: game_state_update (sincronização com Zustand)
    newSocket.on('game_state_update', (data: GameStateData) => {
      console.log('[Socket] Game state update:', data);
      setGameState(data);
      
      // Atualizar estados locais para compatibilidade
      if (data.currentRound) {
        setIsLocked(data.state === 'ROUND_LOCKED');
        setBuzzedPlayerId(data.currentRound.buzzedPlayerId);
      } else {
        setIsLocked(false);
        setBuzzedPlayerId(null);
      }
      
      // Atualizar players
      setPlayers(data.players.map(p => ({
        id: p.id,
        socketId: p.id,
        name: p.name,
        role: 'player' as const,
        roomId: '',
      })));
    });

    // Evento: player_joined
    newSocket.on('player_joined', (data: PlayerJoinedEvent) => {
      console.log('[Socket] Player joined:', data);
      setPlayers(data.players);
    });

    // Evento: player_left
    newSocket.on('player_left', (data: PlayerLeftEvent) => {
      console.log('[Socket] Player left:', data);
      setPlayers(data.players);
    });

    // Evento: buzz_received
    newSocket.on('buzz_received', (data: BuzzReceivedEvent) => {
      console.log('[Socket] Buzz received:', data);
      setIsLocked(true);
      setBuzzedPlayerId(data.playerId);
    });

    // Evento: round_reset
    newSocket.on('round_reset', (data: RoundResetEvent) => {
      console.log('[Socket] Round reset:', data);
      setIsLocked(false);
      setBuzzedPlayerId(null);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const joinGame = useCallback(
    (payload: JoinGamePayload): Promise<JoinGameResponse> => {
      return new Promise((resolve) => {
        if (!socket || !connected) {
          resolve({
            success: false,
            error: 'Socket not connected',
          });
          return;
        }

        socket.emit('join_game', payload, (response: JoinGameResponse) => {
          if (response.success) {
            setRoom({
              id: response.roomId!,
              isLocked: response.isLocked || false,
              buzzedPlayerId: response.buzzedPlayerId || null,
            });
            setCurrentPlayer(response.player || null);
            setPlayers(response.players || []);
            setIsLocked(response.isLocked || false);
            setBuzzedPlayerId(response.buzzedPlayerId || null);
            
            // Sincronizar com Zustand
            setRoomId(response.roomId || null);
            if (response.gameState) {
              setGameState(response.gameState);
            }
            if (response.player) {
              setStorePlayer({
                id: response.player.id,
                name: response.player.name,
                score: 0,
                avatar: '👑',
              });
            }
          }
          resolve(response);
        });
      });
    },
    [socket, connected, setGameState, setStorePlayer, setRoomId]
  );

  const buzz = useCallback(
    (payload: BuzzPayload): Promise<BuzzResponse> => {
      return new Promise((resolve) => {
        if (!socket || !connected) {
          resolve({
            success: false,
            error: 'Socket not connected',
          });
          return;
        }

        socket.emit('buzz', payload, (response: BuzzResponse) => {
          if (response.success && socket.id) {
            setIsLocked(true);
            setBuzzedPlayerId(socket.id);
          }
          resolve(response);
        });
      });
    },
    [socket, connected]
  );

  const resetRound = useCallback(
    (payload: ResetRoundPayload): Promise<ResetRoundResponse> => {
      return new Promise((resolve) => {
        if (!socket || !connected) {
          resolve({
            success: false,
            error: 'Socket not connected',
          });
          return;
        }

        socket.emit('reset_round', payload, (response: ResetRoundResponse) => {
          if (response.success) {
            setIsLocked(false);
            setBuzzedPlayerId(null);
          }
          resolve(response);
        });
      });
    },
    [socket, connected]
  );

  return {
    socket,
    connected,
    room,
    currentPlayer,
    players,
    isLocked,
    buzzedPlayerId,
    joinGame,
    buzz,
    resetRound,
  };
}

