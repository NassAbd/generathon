import { CAPCUT_EXPORT_AUDIO } from "@/lib/capcut/presets";

export function applyBgmVolume(bgm: HTMLAudioElement): void {
  bgm.volume = CAPCUT_EXPORT_AUDIO.bgmVolume;
}

export function syncBgmMutedState(video: HTMLVideoElement, bgm: HTMLAudioElement): void {
  bgm.muted = video.muted;
}

export function syncBgmCurrentTime(video: HTMLVideoElement, bgm: HTMLAudioElement): void {
  const bgmDuration = bgm.duration;
  const targetTime =
    Number.isFinite(bgmDuration) && bgmDuration > 0
      ? video.currentTime % bgmDuration
      : video.currentTime;

  if (Math.abs(bgm.currentTime - targetTime) > 0.2) {
    bgm.currentTime = targetTime;
  }
}

export async function playBgmWithVideo(
  video: HTMLVideoElement,
  bgm: HTMLAudioElement,
): Promise<void> {
  applyBgmVolume(bgm);
  syncBgmMutedState(video, bgm);
  syncBgmCurrentTime(video, bgm);

  if (video.paused) {
    bgm.pause();
    return;
  }

  try {
    await bgm.play();
  } catch (error: unknown) {
    console.warn("[BgmSync] BGM playback failed:", error);
  }
}

export function pauseBgm(bgm: HTMLAudioElement): void {
  bgm.pause();
}
