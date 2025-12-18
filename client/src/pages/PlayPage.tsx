import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';

export default function PlayPage() {
  const [searchParams] = useSearchParams();
  const { connected, room, joinGame, buzz } = useSocket();
  const { gameState, currentPlayer: storePlayer } = useGameStore();
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState(searchParams.get('roomId') || '');
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [buzzError, setBuzzError] = useState<string | null>(null);
  const [isBuzzing, setIsBuzzing] = useState(false);
  const [previousScore, setPreviousScore] = useState(0);
  const [scoreChange, setScoreChange] = useState<number | null>(null);
  const hasVibratedRef = useRef(false);

  useEffect(() => {
    if (roomId && playerName && !hasJoined && connected) {
      handleJoin();
    }
  }, [connected]);

  // Rastrear mudanças de pontuação
  useEffect(() => {
    if (storePlayer && gameState) {
      const currentScore = storePlayer.score;
      if (previousScore !== 0 && currentScore !== previousScore) {
        const change = currentScore - previousScore;
        setScoreChange(change);
        // Limpar após 3 segundos
        setTimeout(() => setScoreChange(null), 3000);
      }
      setPreviousScore(currentScore);
    }
  }, [storePlayer?.score, gameState]);

  // Vibrar quando ganhar a vez
  useEffect(() => {
    if (
      gameState?.state === 'ROUND_LOCKED' &&
      gameState.currentRound?.buzzedPlayerId === storePlayer?.id &&
      !hasVibratedRef.current &&
      'vibrate' in navigator
    ) {
      // Padrão de vibração: vibrar 2x com pausa
      navigator.vibrate([200, 100, 200]);
      hasVibratedRef.current = true;
    }

    // Resetar flag quando a rodada mudar
    if (gameState?.state === 'ROUND_PLAYING' || gameState?.state === 'ROUND_LOADING') {
      hasVibratedRef.current = false;
    }
  }, [gameState?.state, gameState?.currentRound?.buzzedPlayerId, storePlayer?.id]);

  const handleJoin = async () => {
    if (!playerName.trim() || !roomId.trim()) {
      return;
    }

    setIsJoining(true);
    setBuzzError(null);

    const response = await joinGame({
      name: playerName.trim(),
      role: 'player',
      roomId: roomId.trim(),
    });

    if (response.success) {
      setHasJoined(true);
    } else {
      setBuzzError(response.error || 'Erro ao entrar na sala');
    }

    setIsJoining(false);
  };

  const handleBuzz = async () => {
    if (!room || !gameState || gameState.state !== 'ROUND_PLAYING') {
      return;
    }

    const handleBuzz = () => {
      if (!roomId || !storePlayer?.id || isBuzzing) return;
      
      setIsBuzzing(true);
      buzz(roomId, storePlayer.id, (response) => {
        if (!response.success) {
          setBuzzError(response.error || 'Erro ao acionar o buzzer');
          setIsBuzzing(false);
        }
      });
    };

    // Check if player is blocked
    const isBlocked = gameState?.state === 'ROUND_LOCKED' && 
                     gameState.currentRound?.buzzedPlayerId !== storePlayer?.id;

    handleBuzz();
  };

  // Determinar o estado visual
  const getVisualState = () => {
    if (!gameState || !storePlayer) {
      return { type: 'default', message: '', blockedBy: null };
    }

    const currentState = gameState.state;
    const buzzedPlayerId = gameState.currentRound?.buzzedPlayerId;
    const isPlayerTurn = buzzedPlayerId === storePlayer.id;

    if (currentState === 'ROUND_PLAYING') {
      return {
        type: 'playing',
        message: 'BATER!',
        blockedBy: null,
      };
    }

    if (currentState === 'ROUND_LOCKED') {
      if (isPlayerTurn) {
        return {
          type: 'myTurn',
          message: 'SUA VEZ! FALE AGORA!',
          blockedBy: null,
        };
      } else {
        const blockedByPlayer = gameState.players.find((p) => p.id === buzzedPlayerId);
        return {
          type: 'blocked',
          message: `BLOQUEADO por ${blockedByPlayer?.name || 'outro jogador'}`,
          blockedBy: blockedByPlayer?.name || null,
        };
      }
    }

    if (currentState === 'ROUND_RESULT') {
      return {
        type: 'result',
        message: '',
        blockedBy: null,
      };
    }

    return { type: 'default', message: '', blockedBy: null };
  };

  const visualState = getVisualState();
  const isButtonEnabled = gameState?.state === 'ROUND_PLAYING' && !isBuzzing && connected;
  const isBlocked = visualState.type === 'blocked';

  // Determinar cor de fundo baseado no estado
  const getBackgroundClass = () => {
    switch (visualState.type) {
      case 'myTurn':
        return 'bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900';
      case 'blocked':
        return 'bg-gradient-to-br from-red-900 via-red-800 to-rose-900';
      case 'result':
        return 'bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-900';
      case 'playing':
      default:
        return 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900';
    }
  };

  if (!hasJoined) {
    return (
      <motion.div 
        className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 md:p-8 flex flex-col items-center justify-center"
        animate={isBlocked ? {
          x: [0, -10, 10, -10, 10, -5, 5, -2, 2, 0],
          backgroundColor: ['rgba(15, 23, 42, 0.9)', 'rgba(220, 38, 38, 0.2)'],
          transition: { duration: 0.5 }
        } : {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          transition: { duration: 0.3 }
        }}
      >
        <div className="w-full max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            🎵 MusicParty
          </h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-purple-300 text-sm font-medium mb-2">
                Seu Nome
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Digite seu nome"
                className="w-full px-4 py-3 bg-gray-700/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isJoining}
              />
            </div>

            <div>
              <label className="block text-purple-300 text-sm font-medium mb-2">
                ID da Sala
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Digite o ID da sala"
                className="w-full px-4 py-3 bg-gray-700/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                disabled={isJoining}
                maxLength={6}
              />
            </div>

            <AnimatePresence>
              {buzzError && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-4 p-3 bg-red-500/20 border border-red-500/50 text-red-300 text-center rounded-lg"
                >
                  {buzzError}
                </motion.div>
              )}
              
              {scoreChange !== null && (
                <motion.div
                  key={`score-change-${Date.now()}`}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    color: scoreChange > 0 ? '#4ade80' : '#f87171'
                  }}
                  exit={{ opacity: 0, y: -20, scale: 1.2 }}
                  className="text-2xl font-bold mt-4"
                >
                  {scoreChange > 0 ? '+' : ''}{scoreChange} pontos
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`min-h-screen ${getBackgroundClass()} flex items-center justify-center p-4 transition-all duration-500`}>
      <div className="w-full max-w-2xl">
        {/* Status Bar */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-full border border-purple-500/30">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-purple-300 text-sm">
              {connected ? 'Conectado' : 'Desconectado'}
            </span>
            {room && (
              <span className="text-purple-400 text-sm font-mono">
                Sala: {room.id}
              </span>
            )}
            {gameState && (
              <span className="text-purple-300 text-sm">
                Rodada {gameState.roundNumber}/{gameState.totalRounds}
              </span>
            )}
          </div>
        </div>

        {/* ROUND_RESULT: Mostrar pontos */}
        {visualState.type === 'result' && gameState && storePlayer && (
          <div className="mb-6 text-center">
            {scoreChange !== null && (
              <div className={`inline-block px-6 py-3 rounded-2xl text-2xl font-bold ${
                scoreChange > 0
                  ? 'bg-green-500/30 text-green-300 border-2 border-green-400 animate-bounce'
                  : scoreChange < 0
                  ? 'bg-red-500/30 text-red-300 border-2 border-red-400'
                  : 'bg-gray-500/30 text-gray-300 border-2 border-gray-400'
              }`}>
                {scoreChange > 0 ? `+${scoreChange} pontos! 🎉` : scoreChange < 0 ? `${scoreChange} pontos 😢` : 'Sem mudança'}
              </div>
            )}
            <div className="mt-4 text-white text-xl">
              <p className="font-bold">{storePlayer.name}</p>
              <p className="text-3xl font-bold text-purple-300 mt-2">{storePlayer.score} pontos</p>
            </div>
          </div>
        )}

        {/* Main Button/Message Area */}
        <div className="relative">
          {visualState.type === 'myTurn' && (
            <div className="w-full min-h-64 md:min-h-80 rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 flex items-center justify-center border-4 border-blue-400 shadow-2xl animate-pulse p-8">
              <div className="text-center space-y-4 w-full">
                {gameState?.currentRound?.isKaraoke ? (
                  // Interface de Karaokê
                  <>
                    <div className="text-6xl md:text-8xl animate-bounce mb-4">🎤</div>
                    <div className="text-3xl md:text-5xl font-bold text-white mb-4">
                      VOCÊ ESTÁ NO PALCO!
                    </div>
                    <div className="text-2xl md:text-4xl font-bold text-blue-100 mb-6">
                      CANTE!
                    </div>
                    {gameState.currentRound.song.lyrics ? (
                      <div className="bg-blue-700/30 rounded-xl p-6 max-h-96 overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                          {gameState.currentRound.song.title} - {gameState.currentRound.song.artist}
                        </h3>
                        <div className="text-white text-lg leading-relaxed whitespace-pre-line">
                          {gameState.currentRound.song.lyrics}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-700/30 rounded-xl p-6">
                        <p className="text-white text-lg">
                          {gameState.currentRound.song.title} - {gameState.currentRound.song.artist}
                        </p>
                        <p className="text-blue-200 text-sm mt-2">
                          Cante a música completa!
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  // Interface normal
                  <>
                    <div className="text-6xl md:text-8xl animate-bounce">🎤</div>
                    <div className="text-3xl md:text-5xl font-bold text-white">
                      SUA VEZ!
                    </div>
                    <div className="text-2xl md:text-4xl font-bold text-blue-100">
                      FALE AGORA!
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {visualState.type === 'blocked' && (
            <div className="w-full h-64 md:h-80 rounded-3xl bg-gradient-to-br from-red-600 via-red-500 to-rose-600 flex items-center justify-center border-4 border-red-400 shadow-2xl">
              <div className="text-center space-y-4">
                <div className="text-6xl md:text-8xl">🔒</div>
                <div className="text-2xl md:text-4xl font-bold text-white">
                  BLOQUEADO
                </div>
                <div className="text-xl md:text-3xl font-bold text-red-100">
                  por {visualState.blockedBy}
                </div>
              </div>
            </div>
          )}

          {visualState.type === 'playing' && (
            <>
              <motion.button
                onClick={handleBuzz}
                disabled={isBuzzing || !connected || !storePlayer}
                className={`w-full py-6 md:py-8 rounded-2xl font-bold text-2xl md:text-3xl focus:outline-none focus:ring-4 focus:ring-purple-500/50 ${
                  isBuzzing || !connected || !storePlayer
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/50'
                }`}
                whileTap={!isBuzzing && connected && storePlayer ? { 
                  scale: 0.95,
                  transition: { duration: 0.1 }
                } : {}}
              >
                {isBuzzing ? 'Aguardando...' : 'Apertar'}
              </motion.button>

              {/* Neon glow effect when enabled */}
              {isButtonEnabled && (
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-600 via-emerald-500 to-green-600 opacity-50 blur-xl -z-10 animate-pulse" />
              )}
            </>
          )}

          {visualState.type === 'result' && (
            <div className="w-full h-64 md:h-80 rounded-3xl bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-600 flex items-center justify-center border-4 border-purple-400 shadow-2xl">
              <div className="text-center space-y-4">
                <div className="text-6xl md:text-8xl">🎵</div>
                <div className="text-2xl md:text-4xl font-bold text-white">
                  Aguardando resultado...
                </div>
              </div>
            </div>
          )}

          {(visualState.type === 'default' || !gameState) && (
            <div className="w-full h-64 md:h-80 rounded-3xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border-4 border-gray-600 shadow-2xl">
              <div className="text-center space-y-4">
                <div className="text-6xl md:text-8xl">⏳</div>
                <div className="text-xl md:text-3xl font-bold text-gray-300">
                  Aguardando início...
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {buzzError && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-center">
            {buzzError}
          </div>
        )}

        {/* Player Info */}
        {storePlayer && (
          <div className="mt-6 text-center">
            <p className="text-lg text-white/80">
              Jogando como: <span className="font-bold text-purple-300">{storePlayer.name}</span>
            </p>
            {gameState && (
              <p className="text-sm text-white/60 mt-2">
                Pontos: <span className="font-bold text-purple-300">{storePlayer.score}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
