"use client";

/**
 * Tiny Web-Audio sound engine — no audio assets. Tablet autoplay policies
 * require the AudioContext to be created/resumed after a user gesture, so we
 * lazily unlock it on the first interaction.
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

type Note = { freq: number; start: number; dur: number; peak?: number; type?: OscillatorType };

/** Play a sequence of enveloped tones on the shared AudioContext. */
function play(notes: Note[]) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const now = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.value = n.freq;
    const t0 = now + n.start;
    const peak = n.peak ?? 0.22;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + n.dur + 0.02);
  }
}

/** Short vibration on devices that support it (tablets/phones on the floor). */
function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/** Play a short two-tone beep (generic acknowledgement). */
export function beep() {
  play([
    { freq: 880, start: 0, dur: 0.14 },
    { freq: 1320, start: 0.14, dur: 0.16 },
  ]);
}

/**
 * Professional notification sound, chosen by notification type. A new box/carton
 * reaching a station plays a distinctive bright arrival chime (+ a light haptic
 * buzz) so the operator both hears and feels it; other events get their own cue.
 */
export function notifyChime(type?: string) {
  // Non-conform → attention-grabbing descending two-tone (no celebratory chime).
  if (type === "box_rework") {
    play([
      { freq: 660, start: 0, dur: 0.18, type: "triangle", peak: 0.24 },
      { freq: 440, start: 0.17, dur: 0.26, type: "triangle", peak: 0.24 },
    ]);
    buzz([60, 40, 60]);
    return;
  }

  // Box validated conform → a crisp rising confirmation.
  if (type === "box_conform") {
    play([
      { freq: 587.33, start: 0, dur: 0.16 },
      { freq: 880, start: 0.15, dur: 0.24 },
    ]);
    buzz(40);
    return;
  }

  // box_arrived / box_ready → the "new box reached your station" signal:
  // a bright ascending triad (D5–F#5–B5) with a soft harmonic layer, then a
  // ringing tail note for emphasis.
  const triad = [587.33, 739.99, 987.77];
  const notes: Note[] = [];
  triad.forEach((f, i) => {
    notes.push({ freq: f, start: i * 0.11, dur: 0.22, peak: 0.26 });
    notes.push({ freq: f * 2, start: i * 0.11, dur: 0.16, peak: 0.06, type: "triangle" });
  });
  const tail = triad.length * 0.11 + 0.02;
  notes.push({ freq: 987.77, start: tail, dur: 0.3, peak: 0.22 });
  play(notes);
  buzz([50, 30, 50]);
}
