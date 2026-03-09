import { useSettingsStore } from '@/store/settingsStore';

// Web Audio API based SFX — zero latency, no external files needed
const audioCtx = () => {
  if (!(window as any).__gameAudioCtx) {
    (window as any).__gameAudioCtx = new AudioContext();
  }
  return (window as any).__gameAudioCtx as AudioContext;
};

// Random variation helpers
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const vary = (base: number, pct = 0.08) => base * rand(1 - pct, 1 + pct);

function playTone(
  freq: number, duration: number,
  type: OscillatorType = 'sine', volume = 0.3,
  ramp?: 'up' | 'down',
  detune = 0
) {
  const ctx = audioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune + rand(-8, 8); // subtle random detune
  gain.gain.value = volume * rand(0.9, 1.1);

  if (ramp === 'down') {
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  } else if (ramp === 'up') {
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  }

  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.15, filter?: { type: BiquadFilterType; freq: number }) {
  const ctx = audioCtx();
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume * rand(0.85, 1.15);

  if (filter) {
    const bq = ctx.createBiquadFilter();
    bq.type = filter.type;
    bq.frequency.value = filter.freq;
    source.connect(bq).connect(gain).connect(ctx.destination);
  } else {
    source.connect(gain).connect(ctx.destination);
  }
  source.start(ctx.currentTime);
}

function playChord(notes: number[], duration: number, type: OscillatorType, volume: number, stagger = 0) {
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(vary(freq), duration, type, volume / notes.length, 'down'), i * stagger);
  });
}

// ─── Melody player for win/lose/draw music ───
function playMelody(
  notes: { freq: number; dur: number; type?: OscillatorType; vol?: number; delay: number }[],
  baseVolume = 0.2
) {
  notes.forEach(n => {
    setTimeout(() => {
      playTone(vary(n.freq, 0.03), n.dur, n.type || 'sine', (n.vol || 1) * baseVolume, 'down');
    }, n.delay);
  });
}

const isSoundOn = () => useSettingsStore.getState().soundEnabled;

// ═══════════════════════════════════════════════
// BASIC GAME SFX (with random variation)
// ═══════════════════════════════════════════════

export function playDropSound() {
  if (!isSoundOn()) return;
  playNoise(vary(0.12), 0.2, { type: 'lowpass', freq: vary(800) });
  playTone(vary(120), vary(0.1), 'sine', 0.2, 'down');
  // Random wood knock variation
  if (Math.random() > 0.5) {
    setTimeout(() => playTone(vary(180), 0.04, 'triangle', 0.08, 'down'), 20);
  }
}

export function playCaptureSound() {
  if (!isSoundOn()) return;
  const baseFreq = vary(400, 0.12);
  playTone(baseFreq, 0.08, 'triangle', 0.2, 'down');
  setTimeout(() => playTone(baseFreq * 1.5, 0.08, 'triangle', 0.15, 'down'), vary(55, 0.2));
  // Random shimmer
  if (Math.random() > 0.4) {
    setTimeout(() => playTone(baseFreq * 2, 0.06, 'sine', 0.06, 'down'), 110);
  }
}

export function playBasraSound() {
  if (!isSoundOn()) return;
  const root = vary(523, 0.05);
  playTone(root, 0.15, 'square', 0.18, 'down');           // C5
  setTimeout(() => playTone(root * 1.26, 0.15, 'square', 0.18, 'down'), randInt(90, 110));  // E5
  setTimeout(() => playTone(root * 1.5, 0.25, 'square', 0.22, 'down'), randInt(190, 220));   // G5
  setTimeout(() => playTone(root * 2, 0.4, 'sawtooth', 0.13, 'down'), randInt(330, 370));    // C6
  setTimeout(() => playNoise(0.15, 0.22), 0);
  // Extra sparkle variation
  setTimeout(() => playTone(vary(1200), 0.08, 'sine', 0.05, 'down'), randInt(400, 500));
  setTimeout(() => playTone(vary(1600), 0.06, 'sine', 0.04, 'down'), randInt(500, 600));
}

export function playBonbonaSound() {
  if (!isSoundOn()) return;
  const base = vary(300, 0.1);
  playTone(base, 0.1, 'sawtooth', 0.15, 'down');
  setTimeout(() => playTone(base * 0.67, 0.15, 'sawtooth', 0.2, 'down'), randInt(70, 90));
  setTimeout(() => playTone(base * 1.67, 0.3, 'square', 0.18, 'down'), randInt(190, 220));
  setTimeout(() => playTone(base * 2.33, 0.3, 'square', 0.13, 'down'), randInt(330, 370));
  setTimeout(() => playNoise(0.2, 0.18, { type: 'bandpass', freq: vary(1000) }), randInt(140, 170));
}

export function playJokerSound() {
  if (!isSoundOn()) return;
  const ctx = audioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  const startFreq = vary(200, 0.15);
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(startFreq * 6, ctx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.6);
  // Random sparkle pattern
  const sparkleNotes = [1500, 1800, 2200, 2600];
  sparkleNotes.forEach((f, i) => {
    if (Math.random() > 0.3) {
      setTimeout(() => playTone(vary(f, 0.1), 0.1, 'sine', rand(0.04, 0.1), 'down'), 280 + i * randInt(80, 120));
    }
  });
  playNoise(0.3, 0.12, { type: 'highpass', freq: 2000 });
}

export function playInvalidSound() {
  if (!isSoundOn()) return;
  playTone(vary(200), 0.15, 'square', 0.15, 'down');
  setTimeout(() => playTone(vary(150), 0.2, 'square', 0.12, 'down'), randInt(100, 140));
}

export function playSelectSound() {
  if (!isSoundOn()) return;
  playTone(vary(800, 0.1), 0.06, 'sine', 0.1, 'down');
}

export function playDeselectSound() {
  if (!isSoundOn()) return;
  playTone(vary(500, 0.1), 0.06, 'sine', 0.08, 'down');
}

// ═══════════════════════════════════════════════
// OPPONENT-SPECIFIC SOUNDS (deeper, different timbre)
// ═══════════════════════════════════════════════

export function playOpponentDropSound() {
  if (!isSoundOn()) return;
  playNoise(vary(0.1), 0.15, { type: 'lowpass', freq: vary(500) });
  playTone(vary(90), vary(0.12), 'triangle', 0.15, 'down');
}

export function playOpponentCaptureSound() {
  if (!isSoundOn()) return;
  playTone(vary(300), 0.1, 'sawtooth', 0.12, 'down');
  setTimeout(() => playTone(vary(450), 0.08, 'sawtooth', 0.1, 'down'), 70);
}

export function playOpponentBasraSound() {
  if (!isSoundOn()) return;
  // Ominous low tone
  playTone(vary(260), 0.2, 'square', 0.15, 'down');
  setTimeout(() => playTone(vary(330), 0.2, 'square', 0.15, 'down'), 120);
  setTimeout(() => playTone(vary(390), 0.3, 'square', 0.18, 'down'), 240);
  setTimeout(() => playNoise(0.15, 0.15, { type: 'lowpass', freq: 600 }), 0);
}

// ═══════════════════════════════════════════════
// ONLINE-SPECIFIC SOUNDS
// ═══════════════════════════════════════════════

export function playOnlineConnectSound() {
  if (!isSoundOn()) return;
  playTone(vary(600), 0.1, 'sine', 0.12, 'up');
  setTimeout(() => playTone(vary(800), 0.1, 'sine', 0.1, 'up'), 100);
  setTimeout(() => playTone(vary(1000), 0.15, 'sine', 0.08, 'down'), 200);
}

export function playOnlineDisconnectSound() {
  if (!isSoundOn()) return;
  playTone(vary(600), 0.15, 'sine', 0.1, 'down');
  setTimeout(() => playTone(vary(400), 0.2, 'sine', 0.12, 'down'), 120);
  setTimeout(() => playTone(vary(250), 0.3, 'sine', 0.08, 'down'), 260);
}

export function playOnlineYourTurnSound() {
  if (!isSoundOn()) return;
  playTone(vary(880), 0.08, 'sine', 0.12, 'down');
  setTimeout(() => playTone(vary(1100), 0.08, 'sine', 0.1, 'down'), 80);
  setTimeout(() => playTone(vary(1320), 0.12, 'sine', 0.08, 'down'), 160);
}

export function playOnlineOpponentTurnSound() {
  if (!isSoundOn()) return;
  playTone(vary(500), 0.1, 'triangle', 0.08, 'down');
}

// ═══════════════════════════════════════════════
// NAVIGATION / UI SOUNDS
// ═══════════════════════════════════════════════

export function playNavigateSound() {
  if (!isSoundOn()) return;
  playTone(vary(700), 0.05, 'sine', 0.06, 'down');
}

export function playButtonClickSound() {
  if (!isSoundOn()) return;
  playTone(vary(900), 0.04, 'sine', 0.08, 'down');
  playNoise(0.02, 0.03, { type: 'highpass', freq: 4000 });
}

export function playToggleSound(on: boolean) {
  if (!isSoundOn()) return;
  playTone(on ? vary(1000) : vary(600), 0.06, 'sine', 0.08, 'down');
}

export function playCardFlipSound() {
  if (!isSoundOn()) return;
  playNoise(vary(0.06), 0.12, { type: 'bandpass', freq: vary(3000) });
  playTone(vary(1200), 0.03, 'sine', 0.04, 'down');
}

export function playDealSound() {
  if (!isSoundOn()) return;
  // Rapid card dealing
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      playNoise(vary(0.04), rand(0.06, 0.12), { type: 'bandpass', freq: vary(2500) });
    }, i * randInt(80, 120));
  }
}

export function playRoundStartSound() {
  if (!isSoundOn()) return;
  playTone(vary(440), 0.12, 'sine', 0.1, 'up');
  setTimeout(() => playTone(vary(550), 0.12, 'sine', 0.1, 'up'), 120);
  setTimeout(() => playTone(vary(660), 0.2, 'sine', 0.12, 'down'), 240);
  setTimeout(() => playDealSound(), 400);
}

export function playLastCardWarning() {
  if (!isSoundOn()) return;
  playTone(vary(1000), 0.08, 'square', 0.06, 'down');
  setTimeout(() => playTone(vary(1000), 0.08, 'square', 0.06, 'down'), 200);
}

export function playTimerTickSound() {
  if (!isSoundOn()) return;
  playTone(vary(1200), 0.02, 'sine', 0.04, 'down');
}

// ═══════════════════════════════════════════════
// WIN / LOSE / DRAW MUSIC
// ═══════════════════════════════════════════════

export function playWinMusic() {
  if (!isSoundOn()) return;
  // Triumphant ascending fanfare (C major → high C)
  const melody: { freq: number; dur: number; type?: OscillatorType; vol?: number; delay: number }[] = [
    { freq: 523, dur: 0.2, type: 'square', vol: 0.8, delay: 0 },       // C5
    { freq: 587, dur: 0.15, type: 'square', vol: 0.7, delay: 150 },    // D5
    { freq: 659, dur: 0.2, type: 'square', vol: 0.8, delay: 300 },     // E5
    { freq: 784, dur: 0.25, type: 'square', vol: 0.9, delay: 500 },    // G5
    { freq: 880, dur: 0.2, type: 'square', vol: 0.85, delay: 700 },    // A5
    { freq: 1047, dur: 0.5, type: 'sawtooth', vol: 1.0, delay: 900 },  // C6
    { freq: 1047, dur: 0.4, type: 'sine', vol: 0.5, delay: 900 },      // harmony
    { freq: 784, dur: 0.4, type: 'sine', vol: 0.3, delay: 900 },       // harmony
  ];
  playMelody(melody, 0.2);
  // Victory noise burst
  setTimeout(() => playNoise(0.3, 0.15, { type: 'highpass', freq: 2000 }), 850);
  // Sparkle tail
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playTone(vary(1500 + i * 200, 0.1), 0.08, 'sine', rand(0.02, 0.06), 'down'), 1300 + i * 100);
  }
}

export function playLoseMusic() {
  if (!isSoundOn()) return;
  // Descending minor melody, slow and somber
  const melody: { freq: number; dur: number; type?: OscillatorType; vol?: number; delay: number }[] = [
    { freq: 440, dur: 0.4, type: 'sine', vol: 0.7, delay: 0 },        // A4
    { freq: 415, dur: 0.4, type: 'sine', vol: 0.6, delay: 350 },      // Ab4
    { freq: 349, dur: 0.5, type: 'sine', vol: 0.65, delay: 700 },     // F4
    { freq: 330, dur: 0.6, type: 'sine', vol: 0.5, delay: 1100 },     // E4
    { freq: 262, dur: 0.8, type: 'triangle', vol: 0.6, delay: 1600 }, // C4
    { freq: 247, dur: 1.0, type: 'triangle', vol: 0.4, delay: 2200 }, // B3
  ];
  playMelody(melody, 0.18);
  // Low rumble
  setTimeout(() => playTone(vary(80), 1.5, 'sine', 0.06, 'down'), 1500);
}

export function playDrawMusic() {
  if (!isSoundOn()) return;
  // Neutral, contemplative — suspended chord feel
  const melody: { freq: number; dur: number; type?: OscillatorType; vol?: number; delay: number }[] = [
    { freq: 392, dur: 0.3, type: 'triangle', vol: 0.7, delay: 0 },     // G4
    { freq: 440, dur: 0.3, type: 'triangle', vol: 0.6, delay: 250 },   // A4
    { freq: 523, dur: 0.4, type: 'triangle', vol: 0.7, delay: 500 },   // C5
    { freq: 494, dur: 0.5, type: 'sine', vol: 0.5, delay: 800 },       // B4
    { freq: 440, dur: 0.6, type: 'sine', vol: 0.5, delay: 1200 },      // A4
    { freq: 392, dur: 0.8, type: 'sine', vol: 0.4, delay: 1700 },      // G4
  ];
  playMelody(melody, 0.16);
  // Soft shimmer
  setTimeout(() => playNoise(0.2, 0.05, { type: 'highpass', freq: 3000 }), 1600);
}

// ═══════════════════════════════════════════════
// ROUND END MUSIC (shorter than game end)
// ═══════════════════════════════════════════════

export function playRoundWinJingle() {
  if (!isSoundOn()) return;
  playMelody([
    { freq: 523, dur: 0.12, type: 'square', vol: 0.8, delay: 0 },
    { freq: 659, dur: 0.12, type: 'square', vol: 0.8, delay: 100 },
    { freq: 784, dur: 0.2, type: 'square', vol: 0.9, delay: 200 },
    { freq: 1047, dur: 0.3, type: 'sine', vol: 0.7, delay: 350 },
  ], 0.15);
}

export function playRoundLoseJingle() {
  if (!isSoundOn()) return;
  playMelody([
    { freq: 440, dur: 0.2, type: 'sine', vol: 0.6, delay: 0 },
    { freq: 370, dur: 0.25, type: 'sine', vol: 0.5, delay: 200 },
    { freq: 330, dur: 0.35, type: 'triangle', vol: 0.5, delay: 450 },
  ], 0.14);
}

// ═══════════════════════════════════════════════
// FRIEND MODE SOUNDS (warmer, playful)
// ═══════════════════════════════════════════════

export function playFriendJoinSound() {
  if (!isSoundOn()) return;
  playTone(vary(660), 0.1, 'sine', 0.12, 'up');
  setTimeout(() => playTone(vary(880), 0.12, 'sine', 0.1, 'up'), 100);
  setTimeout(() => playTone(vary(1100), 0.15, 'sine', 0.1, 'down'), 220);
  setTimeout(() => playTone(vary(1320), 0.2, 'sine', 0.08, 'down'), 350);
}

export function playPlayerSwitchSound() {
  if (!isSoundOn()) return;
  playTone(vary(700), 0.06, 'triangle', 0.08, 'down');
  setTimeout(() => playTone(vary(900), 0.08, 'triangle', 0.06, 'down'), 60);
}

// ═══════════════════════════════════════════════
// SWEEP / TABLE CLEAR
// ═══════════════════════════════════════════════

export function playTableClearSound() {
  if (!isSoundOn()) return;
  // Whoosh + collect
  const ctx = audioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(vary(300), ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(vary(80), ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.35);
  playNoise(0.2, 0.1, { type: 'lowpass', freq: 1200 });
}

// ═══════════════════════════════════════════════
// SCORE COUNTING TICK
// ═══════════════════════════════════════════════

export function playScoreTickSound() {
  if (!isSoundOn()) return;
  playTone(vary(1100, 0.15), 0.03, 'sine', 0.06, 'down');
}

export function playScoreRevealSound() {
  if (!isSoundOn()) return;
  playChord([523, 659, 784], 0.3, 'sine', 0.15, 30);
}

// ═══════════════════════════════════════════════
// CHAT NOTIFICATION SOUND
// ═══════════════════════════════════════════════

export function playChatNotificationSound() {
  if (!isSoundOn()) return;
  // Gentle two-tone ping
  playTone(vary(1200), 0.08, 'sine', 0.1, 'down');
  setTimeout(() => playTone(vary(1500), 0.12, 'sine', 0.08, 'down'), 90);
}
