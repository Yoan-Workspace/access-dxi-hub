let audioCtx: AudioContext | null = null;

function getAudioContext() {
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

export function unlockWizzAudio() {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

function beep(ctx: AudioContext, start: number, frequency: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(frequency, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.45), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playWizzSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume();
  const now = ctx.currentTime;
  beep(ctx, now, 220, 0.16);
  beep(ctx, now + 0.12, 140, 0.22);
  beep(ctx, now + 0.28, 90, 0.28);
}

export function playWizzEffect() {
  unlockWizzAudio();
  playWizzSound();
  const root = document.documentElement;
  root.classList.remove("dxi-wizzing");
  void root.offsetWidth;
  root.classList.add("dxi-wizzing");
  window.setTimeout(() => root.classList.remove("dxi-wizzing"), 750);
}
