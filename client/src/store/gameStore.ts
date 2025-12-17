import { create } from 'zustand';

export interface Song {
  id: string;
  type: 'intro' | 'reverse' | 'emoji';
  title: string;
  artist: string;
  audioUrl?: string;
  emojis?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  year?: number;
  genre?: string;
  lyrics?: string; // Letra da música para karaokê
}

export type GameState = 
  | 'LOBBY'
  | 'ROUND_LOADING'
  | 'ROUND_PLAYING'
  | 'ROUND_LOCKED'
  | 'ROUND_RESULT'
  | 'GAME_OVER';

export interface GamePlayer {
  id: string;
  name: string;
  score: number;
  avatar: string;
}

export interface CurrentRound {
  song: Song;
  buzzedPlayerId: string | null;
  startTime: number;
  buzzTime?: number;
  isKaraoke?: boolean; // Flag para rodada de karaokê
}

export interface GameStateData {
  state: GameState;
  roundNumber: number;
  totalRounds: number;
  currentRound: CurrentRound | null;
  players: GamePlayer[];
}

interface GameStore {
  // Estado do jogo
  gameState: GameStateData | null;
  currentPlayer: GamePlayer | null;
  roomId: string | null;
  connected: boolean;

  // Ações
  setGameState: (state: GameStateData) => void;
  setCurrentPlayer: (player: GamePlayer | null) => void;
  setRoomId: (roomId: string | null) => void;
  setConnected: (connected: boolean) => void;
  updatePlayer: (playerId: string, updates: Partial<GamePlayer>) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  currentPlayer: null,
  roomId: null,
  connected: false,

  setGameState: (state) => set({ gameState: state }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  setRoomId: (roomId) => set({ roomId }),
  setConnected: (connected) => set({ connected }),
  
  updatePlayer: (playerId, updates) =>
    set((state) => {
      if (!state.gameState) return state;
      
      const updatedPlayers = state.gameState.players.map((p) =>
        p.id === playerId ? { ...p, ...updates } : p
      );

      return {
        gameState: {
          ...state.gameState,
          players: updatedPlayers,
        },
      };
    }),

  reset: () =>
    set({
      gameState: null,
      currentPlayer: null,
      roomId: null,
      connected: false,
    }),
}));

