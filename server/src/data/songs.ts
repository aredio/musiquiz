// ==================== TIPOS ====================

export type SongType = 'intro' | 'reverse' | 'emoji';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Song {
  id: string;
  type: SongType;
  title: string;
  artist: string;
  audioUrl?: string; // Opcional para tipo 'emoji'
  emojis?: string[]; // Opcional para tipos 'intro' e 'reverse'
  difficulty: Difficulty;
  year?: number; // Opcional: ano de lançamento
  genre?: string; // Opcional: gênero musical
  lyrics?: string; // Opcional: letra da música para karaokê
}

// ==================== DADOS DE TESTE ====================

export const SONGS: Song[] = [
  // Tipo: intro - Tocar intro normal
  {
    id: 'song-001',
    type: 'intro',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    audioUrl: 'https://example.com/audio/bohemian-rhapsody-intro.mp3',
    emojis: ['👑', '🎸', '🎹', '🎤'],
    difficulty: 'medium',
    year: 1975,
    genre: 'Rock',
  },

  // Tipo: reverse - Áudio invertido
  {
    id: 'song-002',
    type: 'reverse',
    title: 'Stairway to Heaven',
    artist: 'Led Zeppelin',
    audioUrl: 'https://example.com/audio/stairway-to-heaven-reverse.mp3',
    emojis: ['🎸', '🔥', '⭐', '🌌'],
    difficulty: 'hard',
    year: 1971,
    genre: 'Rock',
  },

  // Tipo: emoji - Dica visual com emojis, sem áudio inicial
  {
    id: 'song-003',
    type: 'emoji',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    audioUrl: undefined, // Sem áudio inicial para este tipo
    emojis: ['💃', '🕺', '🎵', '❤️', '🌍'],
    difficulty: 'easy',
    year: 2017,
    genre: 'Pop',
  },

  // Música para Karaokê (com letra)
  {
    id: 'song-004',
    type: 'intro',
    title: 'Don\'t Stop Believin\'',
    artist: 'Journey',
    audioUrl: 'https://example.com/audio/dont-stop-believin.mp3',
    emojis: ['🎸', '🎤', '⭐', '🌟'],
    difficulty: 'medium',
    year: 1981,
    genre: 'Rock',
    lyrics: `Just a small town girl
Living in a lonely world
She took the midnight train going anywhere

Just a city boy
Born and raised in South Detroit
He took the midnight train going anywhere

A singer in a smoky room
A smell of wine and cheap perfume
For a smile they can share the night
It goes on and on and on and on

Don't stop believin'
Hold on to that feelin'
Streetlight people

Don't stop believin'
Hold on
Streetlight people`,
  },
];

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Busca uma música por ID
 */
export function getSongById(id: string): Song | undefined {
  return SONGS.find((song) => song.id === id);
}

/**
 * Busca músicas por tipo
 */
export function getSongsByType(type: SongType): Song[] {
  return SONGS.filter((song) => song.type === type);
}

/**
 * Busca músicas por dificuldade
 */
export function getSongsByDifficulty(difficulty: Difficulty): Song[] {
  return SONGS.filter((song) => song.difficulty === difficulty);
}

/**
 * Retorna uma música aleatória
 */
export function getRandomSong(): Song {
  const randomIndex = Math.floor(Math.random() * SONGS.length);
  return SONGS[randomIndex];
}

/**
 * Retorna uma música aleatória por tipo
 */
export function getRandomSongByType(type: SongType): Song | undefined {
  const songs = getSongsByType(type);
  if (songs.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * songs.length);
  return songs[randomIndex];
}

/**
 * Retorna uma música aleatória por dificuldade
 */
export function getRandomSongByDifficulty(difficulty: Difficulty): Song | undefined {
  const songs = getSongsByDifficulty(difficulty);
  if (songs.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * songs.length);
  return songs[randomIndex];
}

/**
 * Retorna todas as músicas disponíveis
 */
export function getAllSongs(): Song[] {
  return [...SONGS];
}

/**
 * Retorna o total de músicas
 */
export function getTotalSongs(): number {
  return SONGS.length;
}

