/**
 * Zvuk bzučiakov: každý znejúci bzučiak má vlastný tónový generátor (Web Audio).
 * Prehliadač dovolí zvuk až po prvom kliknutí na stránku.
 */
export class BuzzerSound {
  private ctx: AudioContext | null = null;
  private readonly voices = new Map<string, { osc: OscillatorNode; gain: GainNode; f: number }>();
  muted = false;

  /** Zavolá sa pri kliknutí – až potom môže prehliadač hrať. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  /** Nastaví, ktoré bzučiaky hrajú a akou frekvenciou (0 = ticho). */
  update(tones: Map<string, number>): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const [id, voice] of this.voices) {
      const f = this.muted ? 0 : tones.get(id) ?? 0;
      if (!f) {
        voice.gain.gain.setTargetAtTime(0, now, 0.01);
        voice.osc.stop(now + 0.08);
        this.voices.delete(id);
      } else if (Math.abs(f - voice.f) > 0.5) {
        voice.osc.frequency.setTargetAtTime(f, now, 0.002);
        voice.f = f;
      }
    }
    if (this.muted) return;
    for (const [id, f] of tones) {
      if (!f || this.voices.has(id) || f < 20 || f > 20000) continue;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(0.045, now, 0.005);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      this.voices.set(id, { osc, gain, f });
    }
  }

  stop(): void {
    this.update(new Map());
  }
}
