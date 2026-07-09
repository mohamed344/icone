"use client";

/**
 * Tiny Web-Audio beep — no audio asset. Tablet autoplay policies require the
 * AudioContext to be created/resumed after a user gesture, so we lazily unlock
 * it on the first interaction.
 */
let ctx: AudioContext | null = null;
let unlockBound = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Attach one-time listeners so the first tap/keypress unlocks audio. */
export function ensureAudioUnlocked() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const resume = () => {
    const c = getCtx();
    if (c && c.state === "suspended") void c.resume();
  };
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, resume, { once: false, passive: true }),
  );
}

/** Play a short two-tone chime to signal an incoming box. */
export function beep() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const now = c.currentTime;
  const tones = [880, 1320];
  tones.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + i * 0.14;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  });
}
