export type PlayerRole = 'host' | 'player';

export interface Player {
  id: string;
  socketId: string;
  name: string;
  role: PlayerRole;
  roomId: string;
}

export interface Room {
  id: string;
  isLocked: boolean;
  buzzedPlayerId: string | null;
}

export interface JoinGamePayload {
  name: string;
  role: PlayerRole;
  roomId?: string;
}

export interface BuzzPayload {
  roomId: string;
}

export interface JoinGameResponse {
  success: boolean;
  roomId?: string;
  player?: Player;
  players?: Player[];
  isLocked?: boolean;
  buzzedPlayerId?: string | null;
  gameState?: any; // GameStateData from store
  error?: string;
}

export interface BuzzResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ResetRoundPayload {
  roomId: string;
}

export interface ResetRoundResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface BuzzReceivedEvent {
  playerId: string;
  playerName: string;
  timestamp: number;
}

export interface PlayerJoinedEvent {
  player: Player;
  players: Player[];
}

export interface PlayerLeftEvent {
  playerId: string;
  playerName: string;
  players: Player[];
}

export interface RoundResetEvent {
  timestamp: number;
}

