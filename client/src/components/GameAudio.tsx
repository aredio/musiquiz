import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

interface GameAudioProps {
  /**
   * URL do áudio a ser reproduzido (opcional, pode vir do gameState)
   */
  audioUrl?: string;
  /**
   * Estado do jogo (opcional, pode vir do Zustand)
   */
  gameState?: 'LOBBY' | 'ROUND_LOADING' | 'ROUND_PLAYING' | 'ROUND_LOCKED' | 'ROUND_RESULT' | 'GAME_OVER';
}

export default function GameAudio({ audioUrl: propAudioUrl, gameState: propGameState }: GameAudioProps) {
  const { gameState: storeGameState } = useGameStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasPlayedRef = useRef(false);
  const previousStateRef = useRef<string | null>(null);

  // Determinar URL e estado (props ou store)
  const audioUrl = propAudioUrl || storeGameState?.currentRound?.song.audioUrl;
  const gameState = propGameState || storeGameState?.state;

  // Lógica de playback baseada no estado
  useEffect(() => {
    if (!audioRef.current || !gameState || !audioUrl) {
      return;
    }

    const audio = audioRef.current;

    const handlePlay = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await audio.play();
        setIsPlaying(true);
        hasPlayedRef.current = true;
      } catch (err: any) {
        console.error('Error playing audio:', err);
        setError('Erro ao reproduzir áudio. Verifique a URL.');
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    };

    const handlePause = () => {
      audio.pause();
      setIsPlaying(false);
    };

    // ROUND_PLAYING: Tocar o áudio
    if (gameState === 'ROUND_PLAYING') {
      // Resetar flag quando começar nova rodada
      if (previousStateRef.current !== 'ROUND_PLAYING') {
        hasPlayedRef.current = false;
        audio.currentTime = 0;
      }
      handlePlay();
    }
    // ROUND_LOCKED: PAUSAR imediatamente (criar suspense)
    else if (gameState === 'ROUND_LOCKED') {
      handlePause();
    }
    // ROUND_RESULT: Tocar o áudio novamente (ou do início)
    else if (gameState === 'ROUND_RESULT') {
      // Se ainda não tocou nesta rodada, tocar do início
      if (!hasPlayedRef.current) {
        audio.currentTime = 0;
        handlePlay();
      } else {
        // Se já tocou, pode tocar novamente ou deixar pausado
        // Opção: tocar do início novamente
        audio.currentTime = 0;
        handlePlay();
      }
    }
    // Outros estados: pausar
    else {
      handlePause();
      audio.currentTime = 0;
    }

    previousStateRef.current = gameState;
  }, [gameState, audioUrl]);

  // Atualizar volume quando mudar
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handlers de eventos do áudio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      hasPlayedRef.current = false;
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setError('Erro ao carregar áudio. URL pode estar inválida.');
      setIsPlaying(false);
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  // Atualizar URL do áudio quando mudar
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.load();
      setError(null);
      hasPlayedRef.current = false;
    }
  }, [audioUrl]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const getVolumeIcon = () => {
    if (volume === 0) return '🔇';
    if (volume < 0.3) return '🔈';
    if (volume < 0.7) return '🔉';
    return '🔊';
  };

  // Não renderizar se não houver URL
  if (!audioUrl) {
    return null;
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-4 border border-purple-500/30">
      <div className="flex items-center gap-4">
        {/* Áudio oculto */}
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onError={(e) => {
            console.error('Audio element error:', e);
            setError('Erro ao carregar áudio');
          }}
        />

        {/* Status e Controles */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${
              isLoading
                ? 'bg-yellow-400 animate-pulse'
                : isPlaying
                ? 'bg-green-400 animate-pulse'
                : error
                ? 'bg-red-400'
                : 'bg-gray-400'
            }`} />
            <span className="text-sm text-purple-300">
              {isLoading
                ? 'Carregando...'
                : isPlaying
                ? 'Tocando'
                : error
                ? 'Erro'
                : 'Pausado'}
            </span>
          </div>

          {/* Controle de Volume */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getVolumeIcon()}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              style={{
                background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${volume * 100}%, rgb(55, 65, 81) ${volume * 100}%, rgb(55, 65, 81) 100%)`,
              }}
            />
            <span className="text-xs text-purple-300 w-10 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-xs">
              ⚠️ {error}
            </div>
          )}

          {/* Info da música atual */}
          {storeGameState?.currentRound?.song && (
            <div className="mt-2 text-xs text-purple-400/80">
              {storeGameState.currentRound.song.title} - {storeGameState.currentRound.song.artist}
            </div>
          )}
        </div>

        {/* Botões de controle manual (opcional) */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              if (audioRef.current) {
                if (isPlaying) {
                  audioRef.current.pause();
                } else {
                  audioRef.current.play().catch((err) => {
                    console.error('Play error:', err);
                    setError('Erro ao reproduzir');
                  });
                }
              }
            }}
            disabled={isLoading || !!error}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
          >
            {isPlaying ? '⏸️ Pausar' : '▶️ Tocar'}
          </button>
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch((err) => {
                  console.error('Play error:', err);
                  setError('Erro ao reproduzir');
                });
              }
            }}
            disabled={isLoading || !!error}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
          >
            🔄 Reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}

