interface ActiveSfxSource {
  source: AudioBufferSourceNode;
  slotKey: string | number;
}

/** Optional SFX assets that may 404 — fail silently without console noise. */
const SILENT_OPTIONAL_SFX_PATTERN = /\/(ding|impact)\.mp3(?:\?|$)/i;

function isSilentOptionalSfx(url: string): boolean {
  return SILENT_OPTIONAL_SFX_PATTERN.test(url);
}

function isSkippableHttpStatus(status: number): boolean {
  return status === 400 || status === 404;
}

export class SfxManager {
  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private failedUrls = new Set<string>();
  private activeSources = new Map<string | number, ActiveSfxSource>();
  private muted = false;
  private volume = 1;
  private disabled = false;
  private lastPlayedAtMs = -Infinity;
  private readonly cooldownMs = 1500;

  async preload(urls: string[]): Promise<void> {
    if (this.disabled) {
      return;
    }

    const uniqueUrls = [...new Set(urls.filter(Boolean))];
    if (uniqueUrls.length === 0) {
      return;
    }

    try {
      await this.ensureContext();
    } catch {
      this.disabled = true;
      return;
    }

    await Promise.all(
      uniqueUrls.map(async (url) => {
        if (this.buffers.has(url) || this.failedUrls.has(url)) {
          return;
        }

        try {
          const response = await fetch(url);
          if (!response.ok) {
            this.failedUrls.add(url);

            if (!(isSilentOptionalSfx(url) && isSkippableHttpStatus(response.status))) {
              console.warn(`[SfxManager] SFX preload failed (${response.status}): ${url}`);
            }

            return;
          }

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
          this.buffers.set(url, audioBuffer);
        } catch {
          this.failedUrls.add(url);

          if (!isSilentOptionalSfx(url)) {
            console.warn(`[SfxManager] SFX preload error: ${url}`);
          }
        }
      }),
    );
  }

  async unlock(): Promise<void> {
    if (this.disabled) {
      return;
    }

    try {
      await this.ensureContext();
      if (this.context?.state === "suspended") {
        await this.context.resume();
      }
    } catch {
      this.disabled = true;
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

  play(
    url: string | undefined,
    slotKey: string | number,
    options?: { skipCooldown?: boolean },
  ): void {
    if (!url || this.muted || this.disabled || this.failedUrls.has(url)) {
      return;
    }

    const now = performance.now();
    if (!options?.skipCooldown && now - this.lastPlayedAtMs < this.cooldownMs) {
      return;
    }

    try {
      const buffer = this.buffers.get(url);
      if (!buffer || !this.context || !this.gainNode) {
        this.failedUrls.add(url);
        return;
      }

      this.stopSlot(slotKey);

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);
      source.onended = () => {
        const active = this.activeSources.get(slotKey);
        if (active?.source === source) {
          this.activeSources.delete(slotKey);
        }
      };
      source.start(0);
      this.activeSources.set(slotKey, { source, slotKey });
      this.lastPlayedAtMs = now;
    } catch {
      this.failedUrls.add(url);
    }
  }

  reset(): void {
    for (const slotKey of [...this.activeSources.keys()]) {
      this.stopSlot(slotKey);
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
    if (!this.gainNode) {
      return;
    }

    this.gainNode.gain.value = this.muted ? 0 : this.volume;
  }

  private stopSlot(slotKey: string | number): void {
    const active = this.activeSources.get(slotKey);
    if (!active) {
      return;
    }

    try {
      active.source.stop();
    } catch {
      // Source may have already ended.
    }

    this.activeSources.delete(slotKey);
  }
}
