import { useState, useEffect, useRef } from 'react';
// Define the game state types
// Define the Song type
interface Song {
  id: string;
  name: string;
  artist: string;
  previewUrl: string;
}

interface GameStateData {
  state: 'LOBBY' | 'ROUND_PLAYING' | 'ROUND_LOCKED' | 'ROUND_RESULT' | 'GAME_OVER';
  players: Array<{
    id: string;
    name: string;
    score: number;
    isConnected: boolean;
  }>;
  currentRound?: number;
  totalRounds?: number;
  currentSong?: Song;
  hintRevealed?: boolean;
  isAutoPlay?: boolean;
  currentPlayerId?: string | null;
}
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';
import { QRCodeSVG } from 'qrcode.react';
import GameAudio from '../components/GameAudio';
import KaraokeScoring from '../components/KaraokeScoring';
import { AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function HostPage() {
  const { socket, connected, joinGame } = useSocket();
  const { gameState, roomId, setGameState } = useGameStore();
  const [hostName, setHostName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scoreRefs = useRef<{[key: string]: HTMLSpanElement | null}>({});
  const previousScores = useRef<{[key: string]: number}>({});

  useEffect(() => {
    if (connected && !hasJoined) {
      handleJoin();
    }
  }, [connected]);


  useEffect(() => {
    if (!socket) return;

    // Escutar atualizações de estado do jogo
    socket.on('game_state_update', (data: any) => {
      setGameState(data);
    });

    return () => {
      socket.off('game_state_update');
    };
  }, [socket, setGameState]);

  const handleJoin = async () => {
    const name = hostName.trim() || 'Host';
    const roomId = roomIdInput.trim().toUpperCase() || undefined;

    setIsJoining(true);
    setError(null);

    const response = await joinGame({
      name,
      role: 'host',
      roomId,
    });

    if (response.success) {
      setHasJoined(true);
      if (response.roomId) {
        setRoomIdInput(response.roomId);
      }
    } else {
      setError(response.error || 'Erro ao criar sala');
    }

    setIsJoining(false);
  };

  const handleStartGame = async () => {
    if (!socket || !roomId) return;

    setIsLoading(true);
    setError(null);

    socket.emit('start_game', { roomId }, (response: any) => {
      setIsLoading(false);
      if (!response.success) {
        setError(response.error || 'Erro ao iniciar jogo');
      }
    });
  };

  const handleNextRound = async () => {
    if (!socket || !roomId) return;

    setIsLoading(true);
    setError(null);

    socket.emit('next_round', { roomId }, (response: any) => {
      setIsLoading(false);
      if (!response.success) {
        setError(response.error || 'Erro ao avançar rodada');
      }
    });
  };

  const handleShowResult = async () => {
    if (!socket || !roomId) return;

    setIsLoading(true);
    setError(null);

    socket.emit('show_result', { roomId }, (response: any) => {
      setIsLoading(false);
      if (!response.success) {
        setError(response.error || 'Erro ao mostrar resultado');
      }
    });
  };

  const handleUpdateScore = async (playerId: string, points: number) => {
    if (!socket || !roomId) return;

    socket.emit('update_score', { roomId, playerId, points }, (response: any) => {
      if (response.success) {
        // Trigger confetti when points are added
        if (points > 0) {
          fireConfetti();
        }
      } else {
        setError(response.error || 'Erro ao atualizar pontuação');
      }
    });
  };

  // Control bar actions
  const handlePlayMusic = () => {
    if (!socket || !roomId) return;
    socket.emit('play_music', { roomId });
  };

  const handleRevealHint = () => {
    if (!socket || !roomId) return;
    socket.emit('reveal_hint', { roomId });
  };

  const handleAnswerResult = (isCorrect: boolean) => {
    if (!socket || !roomId) return;
    socket.emit('answer_result', { roomId, isCorrect });
  };

  const fireConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.6 },
      spread: 100,
      ticks: 100,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  // Animate score changes
  useEffect(() => {
    if (!gameState?.players) return;

    gameState.players.forEach(player => {
      const previousScore = previousScores.current[player.id] || 0;
      if (player.score !== previousScore) {
        // Animate the score change
        const element = scoreRefs.current[`score-${player.id}`];
        if (element) {
          element.style.transform = 'scale(1.2)';
          element.style.transition = 'transform 0.3s ease-in-out';
          
          setTimeout(() => {
            if (element) {
              element.style.transform = 'scale(1)';
            }
          }, 300);
        }
        
        previousScores.current[player.id] = player.score;
      }
    });
  }, [gameState?.players]);


  const getJoinUrl = () => {
    if (!roomId) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/play?roomId=${roomId}`;
  };

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-2xl p-8 max-w-md w-full border border-purple-500/30">
          <h1 className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            🎵 MusicParty - Host
          </h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-purple-300 text-sm font-medium mb-2">
                Seu Nome (Host)
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Digite seu nome (opcional)"
                className="w-full px-4 py-3 bg-gray-700/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isJoining}
              />
            </div>

            <div>
              <label className="block text-purple-300 text-sm font-medium mb-2">
                ID da Sala (opcional - deixe vazio para gerar)
              </label>
              <input
                type="text"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Deixe vazio para gerar automaticamente"
                className="w-full px-4 py-3 bg-gray-700/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                disabled={isJoining}
                maxLength={6}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={isJoining || !connected}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-200 shadow-lg shadow-purple-500/50"
            >
              {isJoining ? 'Criando Sala...' : 'Criar Sala'}
            </button>

            {!connected && (
              <p className="text-center text-yellow-400 text-sm">
                Conectando ao servidor...
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Control bar component
  const ControlBar = ({ gameState }: { gameState: GameStateData }) => {
    if (!gameState) return null;

    return (
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/70 backdrop-blur-lg border-t border-purple-500/30 z-50">
        <div className="max-w-4xl mx-auto flex justify-center gap-4">
          {gameState.state === 'LOBBY' && (
            <button
              onClick={handleStartGame}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex-1 max-w-xs"
            >
              {isLoading ? 'Iniciando...' : '🎮 Iniciar Jogo'}
            </button>
          )}

          {gameState.state === 'ROUND_PLAYING' && (
            <>
              {gameState.state === 'ROUND_PLAYING' && !gameState.isAutoPlay && (
                <button
                  onClick={handlePlayMusic}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex-1 max-w-xs"
                >
                  🎵 Tocar Música
                </button>
              )}
              <button
                onClick={handleRevealHint}
                disabled={isLoading || gameState.hintRevealed === true}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex-1 max-w-xs"
              >
                💡 {gameState.hintRevealed === true ? 'Dica Revelada' : 'Revelar Dica'}
              </button>
            </>
          )}

          {gameState.state === 'ROUND_LOCKED' && (
            <div className="flex gap-4 w-full">
              <button
                onClick={() => handleAnswerResult(true)}
                className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-all flex-1 flex items-center justify-center gap-2"
              >
                <span className="text-2xl">✅</span>
                <span>ACERTOU</span>
              </button>
              <button
                onClick={() => handleAnswerResult(false)}
                className="px-6 py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-all flex-1 flex items-center justify-center gap-2"
              >
                <span className="text-2xl">❌</span>
                <span>ERROU</span>
              </button>
            </div>
          )}

          {gameState.state === 'ROUND_RESULT' && (
            <button
              onClick={handleNextRound}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex-1 max-w-xs"
            >
              {isLoading ? 'Carregando...' : '⏭️ Próxima Fase'}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!gameState) {
    return <div>Loading...</div>;
  }

  const currentState = gameState.state;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4 md:pb-24">
      <AnimatePresence mode="wait">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            🎵 MusicParty - Host
          </h1>
          
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-full border border-purple-500/30">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-purple-300 text-sm">
                {connected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            
            {roomId && (
              <div className="px-4 py-2 bg-purple-600/30 rounded-full border border-purple-500/50">
                <span className="text-purple-300 text-sm font-medium">Sala: </span>
                <span className="text-purple-200 text-lg font-bold font-mono">{roomId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Estado atual */}
        <div className="mb-6">
          <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
            currentState === 'LOBBY' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50' :
            currentState === 'ROUND_LOADING' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' :
            currentState === 'ROUND_PLAYING' ? 'bg-green-500/30 text-green-300 border border-green-500/50' :
            currentState === 'ROUND_LOCKED' ? 'bg-red-500/30 text-red-300 border border-red-500/50' :
            currentState === 'ROUND_RESULT' ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50' :
            'bg-gray-500/30 text-gray-300 border border-gray-500/50'
          }`}>
            {currentState === 'LOBBY' && '🏠 LOBBY'}
            {currentState === 'ROUND_LOADING' && '⏳ CARREGANDO RODADA'}
            {currentState === 'ROUND_PLAYING' && '▶️ TOCANDO'}
            {currentState === 'ROUND_LOCKED' && '🔒 BLOQUEADO'}
            {currentState === 'ROUND_RESULT' && '📊 RESULTADO'}
            {currentState === 'GAME_OVER' && '🏁 FIM DO JOGO'}
          </div>
          {gameState && (
            <span className="ml-4 text-purple-300 text-sm">
              Rodada {gameState.roundNumber} / {gameState.totalRounds}
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-center">
            {error}
          </div>
        )}

        {/* LOBBY Screen */}
        {currentState === 'LOBBY' && (
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-2xl border border-purple-500/30 p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* QR Code */}
              <div className="flex flex-col items-center justify-center">
                <h2 className="text-2xl font-bold text-purple-300 mb-4">Escaneie para Jogar</h2>
                <div className="bg-white p-4 rounded-2xl shadow-2xl">
                  <QRCodeSVG
                    value={getJoinUrl()}
                    size={300}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="mt-4 text-purple-300 text-sm text-center">
                  Ou acesse: <br />
                  <span className="font-mono text-purple-400">{getJoinUrl()}</span>
                </p>
              </div>

              {/* Players List */}
              <div>
                <h2 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
                  <span>👥</span>
                  <span>Jogadores ({gameState?.players.length || 0})</span>
                </h2>

                {!gameState || gameState.players.length === 0 ? (
                  <div className="text-center py-12 text-purple-400/60">
                    <div className="text-4xl mb-2">🎮</div>
                    <p>Nenhum jogador na sala ainda</p>
                    <p className="text-sm mt-2">Aguarde os jogadores escanearem o QR Code</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gameState.players.map((player) => (
                      <div
                        key={player.id}
                        className="p-4 bg-gray-700/50 border border-purple-500/30 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{player.avatar}</div>
                          <div>
                            <div className="font-bold text-white">{player.name}</div>
                            <div className="text-purple-300 text-sm">Pontos: {player.score}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleStartGame}
                  disabled={!gameState || gameState.players.length < 2 || isLoading}
                  className="w-full mt-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg transition-all duration-200 shadow-lg shadow-green-500/50"
                >
                  {isLoading ? 'Iniciando...' : '🚀 Começar Jogo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ROUND_LOADING Screen */}
        {currentState === 'ROUND_LOADING' && (
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-2xl border border-yellow-500/30 p-8 text-center">
            <div className="text-6xl mb-4 animate-spin">⏳</div>
            <h2 className="text-3xl font-bold text-yellow-300 mb-2">Carregando Rodada...</h2>
            <p className="text-yellow-400/80">Preparando a próxima música</p>
          </div>
        )}

        {/* ROUND_PLAYING Screen */}
        {currentState === 'ROUND_PLAYING' && gameState?.currentRound && (
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-2xl border border-green-500/30 p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-green-300 mb-4">Rodada {gameState.roundNumber}</h2>
              
              {/* Emojis/Dica */}
              {gameState.currentRound.song.emojis && gameState.currentRound.song.emojis.length > 0 && (
                <div className="mb-6">
                  <div className="text-6xl md:text-8xl flex justify-center gap-4 flex-wrap">
                    {gameState.currentRound.song.emojis.map((emoji: string, index: number) => (
                      <span key={index} className="animate-bounce" style={{ animationDelay: `${index * 0.1}s` }}>
                        {emoji}
                      </span>
                    ))}
                  </div>
                  <p className="text-green-400/80 text-sm mt-4">Dica Visual</p>
                </div>
              )}

              {/* Audio Control */}
              <div className="mb-6">
                <GameAudio />
              </div>

              <p className="text-green-400/60 text-sm">
                Aguardando jogadores buzarem...
              </p>
            </div>
          </div>
        )}

        {/* ROUND_LOCKED Screen */}
        {currentState === 'ROUND_LOCKED' && gameState?.currentRound && (
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-2xl border border-red-500/30 p-8">
            {gameState.currentRound.isKaraoke ? (
              // Interface de Karaokê
              <KaraokeScoring
                players={gameState.players}
                roomId={roomId || ''}
                socket={socket}
                onError={setError}
              />
            ) : (
              // Interface normal (Certo/Errado)
              gameState.currentRound.buzzedPlayerId && (() => {
                const buzzedPlayer = gameState.players.find(p => p.id === gameState.currentRound!.buzzedPlayerId);
                return (
                  <div className="text-center">
                    <div className="mb-8">
                      <div className="text-8xl md:text-9xl font-bold text-red-400 mb-4 animate-pulse">
                        {buzzedPlayer?.name.toUpperCase() || 'JOGADOR'}
                      </div>
                      <div className="text-4xl mb-2">{buzzedPlayer?.avatar}</div>
                      <p className="text-red-300 text-xl">Buzinou primeiro!</p>
                    </div>

                    <div className="flex gap-4 justify-center flex-wrap">
                      <button
                        onClick={() => {
                          if (buzzedPlayer) {
                            handleUpdateScore(buzzedPlayer.id, 10);
                            handleShowResult();
                          }
                        }}
                        disabled={isLoading}
                        className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg transition-all duration-200 shadow-lg shadow-green-500/50"
                      >
                        ✅ Correto (+10pts)
                      </button>
                      <button
                        onClick={() => {
                          handleNextRound();
                        }}
                        disabled={isLoading}
                        className="px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:from-gray-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg transition-all duration-200 shadow-lg shadow-red-500/50"
                      >
                        ❌ Errado (Próxima)
                      </button>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ROUND_RESULT Screen */}
        {currentState === 'ROUND_RESULT' && gameState?.currentRound && (
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-2xl border border-purple-500/30 p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-purple-300 mb-6">Resultado</h2>
              
              {/* Album Cover Placeholder */}
              <div className="mx-auto w-64 h-64 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-2xl flex items-center justify-center mb-6">
                <div className="text-6xl">🎵</div>
              </div>
              
              <h3 className="text-2xl font-semibold text-white mb-4">Música: {gameState.currentRound.song?.name || 'Desconhecida'}</h3>
              <p className="text-gray-300 mb-6">Artista: {gameState.currentRound.song?.artist || 'Desconhecido'}</p>
              
              <div className="mt-8">
                <button
                  onClick={handleNextRound}
                  disabled={isLoading}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-lg transition-all duration-200 shadow-lg shadow-purple-500/50"
                >
                  Próxima Música
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Confetti effect is handled by canvas-confetti */}
      </div>
      </AnimatePresence>
    </div>
  );
};
