import { useState } from 'react';
import type { GamePlayer } from '../store/gameStore';
import type { Socket } from 'socket.io-client';

interface KaraokeScoringProps {
  players: GamePlayer[];
  roomId: string;
  socket: Socket | null;
  onError: (error: string | null) => void;
}

export default function KaraokeScoring({ players, roomId, socket, onError }: KaraokeScoringProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [scoreAmount, setScoreAmount] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scoredPlayers, setScoredPlayers] = useState<Set<string>>(new Set());

  const handlePlayerClick = (playerId: string) => {
    if (scoredPlayers.has(playerId)) {
      return; // Já pontuado
    }
    setSelectedPlayer(playerId);
    setScoreAmount(5); // Reset para valor padrão
  };

  const handleConfirmScore = () => {
    if (!selectedPlayer || !socket || !roomId) return;

    setIsSubmitting(true);
    onError(null);

    socket.emit(
      'host_give_score',
      {
        roomId,
        playerId: selectedPlayer,
        scoreAmount,
      },
      (response: any) => {
        setIsSubmitting(false);
        if (response.success) {
          setScoredPlayers((prev) => new Set([...prev, selectedPlayer]));
          setSelectedPlayer(null);
        } else {
          onError(response.error || 'Erro ao dar pontuação');
        }
      }
    );
  };

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setScoreAmount(value);
  };

  const getPlayer = (playerId: string) => {
    return players.find((p) => p.id === playerId);
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-purple-300 mb-2">🎤 Rodada de Karaokê</h2>
        <p className="text-purple-400/80">Avalie cada jogador (0-10 pontos)</p>
      </div>

      {/* Lista de Jogadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {players.map((player) => {
          const isScored = scoredPlayers.has(player.id);
          const isSelected = selectedPlayer === player.id;

          return (
            <div
              key={player.id}
              onClick={() => !isScored && handlePlayerClick(player.id)}
              className={`
                p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                ${
                  isSelected
                    ? 'bg-purple-600/30 border-purple-400 scale-105'
                    : isScored
                    ? 'bg-gray-700/30 border-gray-500 opacity-60 cursor-not-allowed'
                    : 'bg-gray-700/50 border-purple-500/30 hover:border-purple-400 hover:bg-gray-700/70'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{player.avatar}</div>
                  <div>
                    <div className="font-bold text-white text-lg">{player.name}</div>
                    <div className="text-purple-300 text-sm">Pontos: {player.score}</div>
                  </div>
                </div>
                {isScored && (
                  <div className="text-green-400 font-bold">✓ Avaliado</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Painel de Pontuação */}
      {selectedPlayer && !scoredPlayers.has(selectedPlayer) && (
        <div className="bg-purple-600/20 border-2 border-purple-400 rounded-xl p-6">
          <div className="text-center mb-4">
            <h3 className="text-2xl font-bold text-white mb-2">
              Avaliar: {getPlayer(selectedPlayer)?.name}
            </h3>
            <div className="text-4xl mb-2">{getPlayer(selectedPlayer)?.avatar}</div>
          </div>

          <div className="mb-6">
            <label className="block text-purple-300 text-sm font-medium mb-2 text-center">
              Pontuação: <span className="text-2xl font-bold text-purple-200">{scoreAmount}</span> / 10
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={scoreAmount}
              onChange={handleScoreChange}
              className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              style={{
                background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${(scoreAmount / 10) * 100}%, rgb(55, 65, 81) ${(scoreAmount / 10) * 100}%, rgb(55, 65, 81) 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-purple-400 mt-1">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setSelectedPlayer(null)}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmScore}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-200 shadow-lg shadow-purple-500/50"
            >
              {isSubmitting ? 'Confirmando...' : '✅ Confirmar Nota'}
            </button>
          </div>
        </div>
      )}

      {/* Progresso */}
      {scoredPlayers.size > 0 && (
        <div className="mt-6 text-center">
          <p className="text-purple-300 text-sm">
            Avaliados: {scoredPlayers.size} / {players.length}
          </p>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(scoredPlayers.size / players.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}


