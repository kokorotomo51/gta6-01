// Sound, all synthesised with WebAudio — no audio files, no network.
// Every call is guarded: before the first click the AudioContext is suspended
// and in screenshot mode there is no gesture at all, so nothing may throw.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c || c.state !== 'running') return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.12, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur);
    } catch {
      // Sound is garnish; a failure must never break the game.
    }
  }

  function noise(dur, vol, low) {
    if (muted) return;
    const c = ensure();
    if (!c || c.state !== 'running') return;
    try {
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = low ? 'lowpass' : 'highpass';
      filter.frequency.value = low ? 900 : 1200;
      const gain = c.createGain();
      gain.gain.value = vol || 0.2;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      src.start();
    } catch {
      // Ignore.
    }
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') {
      c.resume().catch(() => {});
    }
  }

  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  return {
    unlock,
    setMuted(value) { muted = value; },
    isMuted() { return muted; },
    shot(weapon) {
      noise(0.09, weapon === 'rifle' ? 0.3 : 0.2, true);
      tone(weapon === 'rifle' ? 180 : 140, 0.08, 'square', 0.06, 60);
    },
    crash() { noise(0.25, 0.25, true); tone(90, 0.2, 'sawtooth', 0.08, 40); },
    hurt() { tone(220, 0.18, 'sawtooth', 0.1, 110); },
    pickup() { tone(660, 0.09, 'sine', 0.12); tone(990, 0.12, 'sine', 0.1); },
    coin() { tone(880, 0.08, 'sine', 0.12); tone(1320, 0.14, 'sine', 0.1); },
    door() { tone(320, 0.07, 'triangle', 0.1, 180); },
    carjack() { tone(520, 0.12, 'square', 0.08, 260); tone(780, 0.14, 'square', 0.08, 390); },
    reload() { tone(440, 0.06, 'triangle', 0.08); tone(330, 0.08, 'triangle', 0.08); },
    missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.12), i * 110)); },
    missionComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.12), i * 120)); },
    missionFail() { [400, 350, 300].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.08), i * 140)); },
    sirenBurst() { tone(700, 0.3, 'sine', 0.07, 950); tone(950, 0.3, 'sine', 0.07, 700); },
    /** Two-tone police siren while cops are near; call every frame. */
    siren(dt, active) {
      if (!active) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        tone(680, 0.4, 'sine', 0.045, 920);
      }
    },
    /** Engine hum tied to speed; call every frame while driving. */
    engine(speed, maxSpeed) {
      if (muted) return;
      const c = ensure();
      if (!c || c.state !== 'running') return;
      try {
        if (!engineOsc) {
          engineOsc = c.createOscillator();
          engineGain = c.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0;
          const filter = c.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 420;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(c.destination);
          engineOsc.start();
        }
        const ratio = Math.abs(speed) / Math.max(1, maxSpeed);
        engineOsc.frequency.setValueAtTime(55 + ratio * 130, c.currentTime);
        engineGain.gain.setTargetAtTime(0.02 + ratio * 0.05, c.currentTime, 0.1);
      } catch {
        // Ignore.
      }
    },
    engineOff() {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx ? ctx.currentTime : 0, 0.1);
    },
  };
}
