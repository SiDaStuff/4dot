let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gainNode.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {}
}

export function playSoundPlace(volume: number = 0.5) {
  playTone(600, 0.08, 'sine', volume);
  setTimeout(() => playTone(800, 0.06, 'sine', volume * 0.6), 30);
}

export function playSoundMove(volume: number = 0.5) {
  playTone(400, 0.1, 'triangle', volume);
  setTimeout(() => playTone(500, 0.08, 'triangle', volume * 0.5), 40);
}

export function playSoundGameEnd(volume: number = 0.5) {
  playTone(300, 0.2, 'sine', volume);
  setTimeout(() => playTone(250, 0.2, 'sine', volume * 0.8), 150);
  setTimeout(() => playTone(200, 0.4, 'sine', volume * 0.6), 300);
}

export function playSoundGameWin(volume: number = 0.5) {
  playTone(523, 0.12, 'sine', volume);
  setTimeout(() => playTone(659, 0.12, 'sine', volume), 100);
  setTimeout(() => playTone(784, 0.12, 'sine', volume), 200);
  setTimeout(() => playTone(1047, 0.3, 'sine', volume * 1.2), 300);
}

export function playSoundGameStart(volume: number = 0.5) {
  playTone(440, 0.1, 'sine', volume);
  setTimeout(() => playTone(554, 0.1, 'sine', volume), 80);
  setTimeout(() => playTone(659, 0.15, 'sine', volume), 160);
}

export function playSoundDrawOffer(volume: number = 0.5) {
  playTone(500, 0.15, 'triangle', volume);
  setTimeout(() => playTone(500, 0.15, 'triangle', volume * 0.7), 200);
}

export function playSoundError(volume: number = 0.5) {
  playTone(200, 0.15, 'sawtooth', volume * 0.3);
}

export function playSoundClick(volume: number = 0.5) {
  playTone(700, 0.04, 'sine', volume * 0.5);
}
