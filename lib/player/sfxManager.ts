/**
 * SFX playback is intentionally disabled — focus is face tracking + kinetic subtitles.
 * API surface is retained so call sites compile without wiring audio events.
 */
export class SfxManager {
  private disabled = true;

  async preload(_urls: string[]): Promise<void> {
    return;
  }

  async unlock(): Promise<void> {
    return;
  }

  setMuted(_muted: boolean): void {
    return;
  }

  setVolume(_volume: number): void {
    return;
  }

  play(
    _url: string | undefined,
    _slotKey: string | number,
    _options?: { skipCooldown?: boolean },
  ): void {
    return;
  }

  reset(): void {
    return;
  }

  get isDisabled(): boolean {
    return this.disabled;
  }
}
