import type { Song } from './data/songs';
import { getRandomSong } from './data/songs';

// ==================== TIPOS E INTERFACES ====================

export type GameState = 
  | 'LOBBY'           // Sala aguardando jogadores
  | 'ROUND_LOADING'   // Carregando próxima rodada
  | 'ROUND_PLAYING'   // Tocando áudio/esperando buzz
  | 'ROUND_LOCKED'    // Alguém apertou, música para
  | 'ROUND_RESULT'    // Mostra resposta
  | 'GAME_OVER';      // Fim do jogo

export interface GamePlayer {
  id: string;
  socketId: string;
  name: string;
  score: number;
  avatar: string;
  roomId: string;
}

export interface CurrentRound {
  song: Song;
  buzzedPlayerId: string | null;
  startTime: number;
  buzzTime?: number; // Timestamp quando alguém buzou
  isKaraoke?: boolean; // Flag para rodada de karaokê (rodada final)
}

export interface GameRoom {
  id: string;
  hostId: string;
  state: GameState;
  players: Map<string, GamePlayer>;
  currentRound: CurrentRound | null;
  roundNumber: number;
  totalRounds: number;
  songsPlayed: string[]; // IDs das músicas já tocadas
}

// ==================== CLASSE GAME MANAGER ====================

export class GameManager {
  private rooms: Map<string, GameRoom> = new Map();
  private players: Map<string, GamePlayer> = new Map();

  /**
   * Cria uma nova sala de jogo
   */
  createRoom(hostId: string, hostName: string, roomId?: string): string {
    const newRoomId = roomId || this.generateRoomId();
    
    if (this.rooms.has(newRoomId)) {
      throw new Error('Room already exists');
    }

    const room: GameRoom = {
      id: newRoomId,
      hostId,
      state: 'LOBBY',
      players: new Map(),
      currentRound: null,
      roundNumber: 0,
      totalRounds: 10, // Padrão: 10 rodadas
      songsPlayed: [],
    };

    const host: GamePlayer = {
      id: hostId,
      socketId: hostId,
      name: hostName,
      score: 0,
      avatar: this.generateAvatar(),
      roomId: newRoomId,
    };

    room.players.set(hostId, host);
    this.players.set(hostId, host);
    this.rooms.set(newRoomId, room);

    return newRoomId;
  }

  /**
   * Adiciona um jogador à sala
   */
  addPlayer(socketId: string, name: string, roomId: string): GamePlayer {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Verificar se o jogador já existe
    if (room.players.has(socketId)) {
      return room.players.get(socketId)!;
    }

    const player: GamePlayer = {
      id: socketId,
      socketId,
      name,
      score: 0,
      avatar: this.generateAvatar(),
      roomId,
    };

    room.players.set(socketId, player);
    this.players.set(socketId, player);

    return player;
  }

  /**
   * Remove um jogador da sala
   */
  removePlayer(socketId: string): { room: GameRoom | null; player: GamePlayer | null } {
    const player = this.players.get(socketId);
    if (!player) {
      return { room: null, player: null };
    }

    const room = this.rooms.get(player.roomId);
    if (!room) {
      this.players.delete(socketId);
      return { room: null, player };
    }

    room.players.delete(socketId);
    this.players.delete(socketId);

    // Se o host sair, transferir host ou deletar sala
    if (player.id === room.hostId) {
      const remainingPlayers = Array.from(room.players.values());
      if (remainingPlayers.length > 0) {
        const newHost = remainingPlayers[0];
        room.hostId = newHost.socketId;
      } else {
        // Deletar sala se estiver vazia
        this.rooms.delete(room.id);
        return { room: null, player };
      }
    }

    return { room, player };
  }

  /**
   * Inicia o jogo (transição de LOBBY para ROUND_LOADING)
   */
  startGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.state !== 'LOBBY') {
      throw new Error('Game already started');
    }

    if (room.players.size < 2) {
      throw new Error('Need at least 2 players to start');
    }

    room.state = 'ROUND_LOADING';
    room.roundNumber = 0;
    room.songsPlayed = [];
  }

  /**
   * Avança para a próxima rodada
   */
  nextRound(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Se estiver em LOBBY, iniciar o jogo
    if (room.state === 'LOBBY') {
      this.startGame(roomId);
    }

    // Verificar se o jogo acabou
    if (room.roundNumber >= room.totalRounds) {
      room.state = 'GAME_OVER';
      room.currentRound = null;
      return;
    }

    // Selecionar uma música aleatória que ainda não foi tocada
    let song: Song | undefined;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      song = getRandomSong();
      attempts++;
      if (attempts >= maxAttempts) {
        // Se tentou muitas vezes, resetar lista de músicas tocadas
        room.songsPlayed = [];
        song = getRandomSong();
        break;
      }
    } while (song && room.songsPlayed.includes(song.id));

    if (!song) {
      throw new Error('No songs available');
    }

    room.roundNumber++;
    room.songsPlayed.push(song.id);
    room.state = 'ROUND_LOADING';

    // Verificar se é a última rodada (Karaokê)
    const isKaraoke = room.roundNumber === room.totalRounds;

    // Após um delay, mudar para ROUND_PLAYING
    // (Isso será gerenciado pelo servidor com setTimeout)
    room.currentRound = {
      song,
      buzzedPlayerId: null,
      startTime: Date.now(),
      isKaraoke,
    };
  }

  /**
   * Transição de ROUND_LOADING para ROUND_PLAYING
   */
  startRoundPlaying(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.state !== 'ROUND_LOADING' || !room.currentRound) {
      throw new Error('Invalid state transition');
    }

    room.state = 'ROUND_PLAYING';
    room.currentRound.startTime = Date.now();
  }

  /**
   * Processa um buzz de um jogador
   * @returns true se foi o primeiro buzz, false se já estava travado
   */
  handleBuzz(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.state !== 'ROUND_PLAYING') {
      return false; // Não está na fase de tocar
    }

    if (!room.currentRound) {
      return false;
    }

    // Se já tem alguém que buzou, retorna false
    if (room.currentRound.buzzedPlayerId !== null) {
      return false;
    }

    // Registrar o buzz
    room.currentRound.buzzedPlayerId = playerId;
    room.currentRound.buzzTime = Date.now();
    room.state = 'ROUND_LOCKED';

    return true;
  }

  /**
   * Transição para ROUND_RESULT (mostra a resposta)
   */
  showRoundResult(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.state !== 'ROUND_LOCKED') {
      throw new Error('Invalid state transition');
    }

    room.state = 'ROUND_RESULT';
  }

  /**
   * Atualiza a pontuação de um jogador
   */
  updateScore(roomId: string, playerId: string, points: number): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const player = room.players.get(playerId);
    if (!player) {
      throw new Error('Player not found in room');
    }

    player.score = Math.max(0, player.score + points);
  }

  /**
   * Dá uma pontuação customizada (usado no karaokê)
   * @param roomId ID da sala
   * @param playerId ID do jogador
   * @param scoreAmount Quantidade de pontos (0-10)
   */
  giveScore(roomId: string, playerId: string, scoreAmount: number): void {
    if (scoreAmount < 0 || scoreAmount > 10) {
      throw new Error('Score amount must be between 0 and 10');
    }

    this.updateScore(roomId, playerId, scoreAmount);
  }

  /**
   * Retorna o estado atual da sala
   */
  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Retorna um jogador
   */
  getPlayer(socketId: string): GamePlayer | undefined {
    return this.players.get(socketId);
  }

  /**
   * Retorna lista de jogadores da sala
   */
  getPlayersInRoom(roomId: string): GamePlayer[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }
    return Array.from(room.players.values());
  }

  /**
   * Verifica se um jogador é o host
   */
  isHost(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    return room.hostId === playerId;
  }

  /**
   * Reseta a rodada (volta para ROUND_PLAYING ou inicia próxima)
   */
  resetRound(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.state === 'ROUND_LOCKED' || room.state === 'ROUND_RESULT') {
      // Resetar para próxima rodada
      room.currentRound = null;
      this.nextRound(roomId);
    }
  }

  /**
   * Gera um ID único para a sala
   */
  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Gera um avatar aleatório para o jogador
   */
  private generateAvatar(): string {
    const avatars = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎸', '🎹', '🥁', '🎤', '🎧', '🎵', '🎶', '🎼', '🎺', '🎷'];
    return avatars[Math.floor(Math.random() * avatars.length)];
  }
}

