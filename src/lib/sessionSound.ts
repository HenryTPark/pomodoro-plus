type AudioContextConstructor = typeof AudioContext;

let sharedContext: AudioContext | null = null;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext ||
    null
  );
}

function getAudioContext(): AudioContext | null {
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) {
    return null;
  }

  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioContextCtor();
  }

  return sharedContext;
}

/** Call from a user gesture (e.g. Start) so later timer-end chimes are allowed. */
export function unlockSessionSound(): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    void context.resume();
  }
}

function scheduleTone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(0.28, startAt + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

/** Two-tone chime when a focus/break segment ends. */
export async function playSessionEndSound(): Promise<void> {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    await context.resume();
  }

  const now = context.currentTime;
  scheduleTone(context, 880, now, 0.18);
  scheduleTone(context, 1175, now + 0.2, 0.28);
}
