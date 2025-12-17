import { useRef } from 'react';

const soundEffects = [
  {
    id: 'applause',
    label: '👏 Aplausos',
    src: 'https://assets.mixkit.co/sfx/preview/mixkit-audience-clapping-loudly-2037.mp3',
  },
  {
    id: 'crickets',
    label: '🦗 Grilos',
    src: 'https://assets.mixkit.co/sfx/preview/mixkit-crickets-chirping-in-the-night-1243.mp3',
  },
  {
    id: 'buzzer',
    label: '❌ Buzina',
    src: 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-buzzer-962.mp3',
  },
  {
    id: 'drumroll',
    label: '🥁 Ba Dum Tss',
    src: 'https://assets.mixkit.co/sfx/preview/mixkit-drum-rimshot-1103.mp3',
  },
];

export default function Soundboard() {
  const audioRefs = useRef<{[key: string]: HTMLAudioElement | null}>({});

  const playSound = (id: string) => {
    const audio = audioRefs.current[id];
    if (audio) {
      audio.currentTime = 0; // Rewind to the start
      audio.play().catch(e => console.error('Error playing sound:', e));
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-lg border-t border-purple-500/30 p-3 z-50">
      <div className="max-w-7xl mx-auto">
        <h3 className="text-sm font-semibold text-purple-300 mb-2">Soundboard</h3>
        <div className="flex flex-wrap gap-2">
          {soundEffects.map((effect) => (
            <div key={effect.id} className="relative">
              <button
                onClick={() => playSound(effect.id)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-purple-700/50 text-white text-sm rounded-lg transition-colors border border-purple-500/30"
              >
                {effect.label}
              </button>
              <audio
                ref={(el) => (audioRefs.current[effect.id] = el)}
                src={effect.src}
                preload="auto"
                className="hidden"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
