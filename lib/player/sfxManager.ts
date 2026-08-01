export class SfxManager {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private failedUrls = new Set<string>();
  private activeSource: AudioBufferSourceNode | null = null;
  private lastTriggeredIndex = -1;

  async preload(urls: string[]): Promise<void> {
    const uniqueUrls = [...new Set(urls.filter(Boolean))];
    if (uniqueUrls.length === 0) return;

    try {
      this.context ??= new AudioContext();
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
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") {
        await this.context.resume();
      }
    } catch (error: unknown) {
      console.warn("[SfxManager] Failed to unlock audio context:", error);
    }
  }

  play(url: string | undefined, wordIndex: number): void {
    if (!url || wordIndex === this.lastTriggeredIndex || this.failedUrls.has(url)) return;

    try {
      const buffer = this.buffers.get(url);
      if (!buffer || !this.context) {
        if (!this.failedUrls.has(url)) {
          console.warn(`[SfxManager] SFX not loaded, skipping playback: ${url}`);
        }
        return;
      }

      this.stopActive();
      this.lastTriggeredIndex = wordIndex;

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.onended = () => {
        if (this.activeSource === source) {
          this.activeSource = null;
        }
      };
      source.start(0);
      this.activeSource = source;
    } catch (error: unknown) {
      this.failedUrls.add(url);
      console.warn(`[SfxManager] SFX playback failed: ${url}`, error);
    }
  }

  reset(): void {
    this.lastTriggeredIndex = -1;
    this.stopActive();
  }

  private stopActive(): void {
    if (!this.activeSource) return;
    try {
      this.activeSource.stop();
    } catch {
      // Source may have already ended.
    }
    this.activeSource = null;
  }
}
