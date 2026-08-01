interface ActiveSfxSource {
  source: AudioBufferSourceNode;
  wordIndex: number;
}

export class SfxManager {
  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private failedUrls = new Set<string>();
  private activeSources = new Map<number, ActiveSfxSource>();
  private muted = false;
  private volume = 1;

  async preload(urls: string[]): Promise<void> {
    const uniqueUrls = [...new Set(urls.filter(Boolean))];
    if (uniqueUrls.length === 0) return;

    try {
      await this.ensureContext();
    } catch (error: unknown) {
      console.warn("[SfxManager] Web Audio context unavailable:", error);
      return;
    }

    await Promise.all(
      uniqueUrls.map(async (url) => {
        if (this.buffers.has(url) || this.failedUrls.has(url)) return;

        try {
          const response = await fetch(url);
          if (!response.ok) {
            this.failedUrls.add(url);
            console.warn(`[SfxManager] SFX preload failed (${response.status}): ${url}`);
            return;
          }

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
          this.buffers.set(url, audioBuffer);
        } catch (error: unknown) {
          this.failedUrls.add(url);
          console.warn(`[SfxManager] SFX preload error: ${url}`, error);
        }
      }),
    );
  }

  async unlock(): Promise<void> {
    try {
      await this.ensureContext();
      if (this.context?.state === "suspended") {
        await this.context.resume();
      }
    } catch (error: unknown) {
      console.warn("[SfxManager] Failed to unlock audio context:", error);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.applyGain();
  }

  play(url: string | undefined, wordIndex: number): void {
    if (!url || this.muted || this.failedUrls.has(url)) return;

    try {
      const buffer = this.buffers.get(url);
      if (!buffer || !this.context || !this.gainNode) {
        if (!this.failedUrls.has(url)) {
          console.warn(`[SfxManager] SFX not loaded, skipping playback: ${url}`);
        }
        return;
      }

      this.stopWord(wordIndex);

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);
      source.onended = () => {
        const active = this.activeSources.get(wordIndex);
        if (active?.source === source) {
          this.activeSources.delete(wordIndex);
        }
      };
      source.start(0);
      this.activeSources.set(wordIndex, { source, wordIndex });
    } catch (error: unknown) {
      this.failedUrls.add(url);
      console.warn(`[SfxManager] SFX playback failed: ${url}`, error);
    }
  }

  reset(): void {
    for (const wordIndex of [...this.activeSources.keys()]) {
      this.stopWord(wordIndex);
    }
    this.activeSources.clear();
  }

  private async ensureContext(): Promise<void> {
    this.context ??= new AudioContext();
    if (!this.gainNode) {
      this.gainNode = this.context.createGain();
      this.gainNode.connect(this.context.destination);
      this.applyGain();
    }
  }

  private applyGain(): void {
    if (!this.gainNode) return;
    this.gainNode.gain.value = this.muted ? 0 : this.volume;
  }

  private stopWord(wordIndex: number): void {
    const active = this.activeSources.get(wordIndex);
    if (!active) return;

    try {
      active.source.stop();
    } catch {
      // Source may have already ended.
    }

    this.activeSources.delete(wordIndex);
  }
}
