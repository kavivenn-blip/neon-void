// Synthesised sound effects, no audio files: a tiny WebAudio synth (oscillator blips and
// filtered noise) whose pitch follows the action — the pickup blip climbs with the multiplier.
// The context is created on the first user gesture and stays silent before that, so the
// screenshot scenes and a muted tab make no sound. M toggles mute.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** Resume (and create) the context from a user gesture. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, endFreq, seconds, type, volume) {
    if (!ensure() || muted || context.state !== 'running') return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  function noise(seconds, filterFreq, volume) {
    if (!ensure() || muted || context.state !== 'running') return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(880, 320, 0.07, 'square', 0.05);
    },
    explode(big) {
      noise(big ? 0.5 : 0.25, big ? 900 : 1600, big ? 0.5 : 0.3);
      tone(big ? 160 : 220, 40, big ? 0.45 : 0.25, 'sawtooth', 0.18);
    },
    pickup(multiplier) {
      const base = 520 * (1 + Math.min(multiplier, 40) * 0.03);
      tone(base, base * 1.5, 0.09, 'sine', 0.12);
    },
    bomb() {
      noise(0.9, 500, 0.6);
      tone(90, 28, 0.8, 'sine', 0.5);
    },
    hit() {
      noise(0.35, 700, 0.45);
      tone(200, 50, 0.3, 'sawtooth', 0.25);
    },
    extraLife() {
      tone(660, 660, 0.1, 'sine', 0.15);
      setTimeout(() => tone(880, 880, 0.12, 'sine', 0.15), 90);
      setTimeout(() => tone(1320, 1320, 0.18, 'sine', 0.15), 180);
    },
    wave() {
      tone(392, 392, 0.12, 'triangle', 0.14);
      setTimeout(() => tone(523, 523, 0.16, 'triangle', 0.14), 110);
    },
    gameOver() {
      tone(392, 392, 0.18, 'triangle', 0.16);
      setTimeout(() => tone(311, 311, 0.18, 'triangle', 0.16), 170);
      setTimeout(() => tone(233, 196, 0.4, 'triangle', 0.16), 340);
    },
  };
}
