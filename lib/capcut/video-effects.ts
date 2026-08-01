export const CANVAS_ASPECT = 9 / 16;

export const CAPCUT_CANVAS_WIDTH = 1080;
export const CAPCUT_CANVAS_HEIGHT = 1920;
export const CAPCUT_CANVAS_RATIO = "9:16";

/** Width/height above native 9:16 (~0.5625) triggers letterbox background blur. */
export const BACKGROUND_BLUR_ASPECT_THRESHOLD = 0.6;

/** CapCut canvas blur strength for letterbox background fill (0–1). */
export const CAPCUT_BACKGROUND_BLUR = 1.0;

/** True when source footage is not native 9:16 vertical (horizontal, square, or other portrait). */
export function isNonVerticalCanvasVideo(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) {
    return false;
  }

  const aspect = width / height;

  // Horizontal or square footage always needs letterbox blur on a 9:16 canvas.
  if (aspect >= 1) {
    return true;
  }

  // Portrait footage that is not native 9:16.
  return Math.abs(aspect - CANVAS_ASPECT) > 0.08;
}

/** Whether a blurred background fill layer is required for the source footage. */
export function needsBackgroundBlurLayer(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) {
    return false;
  }

  const aspect = width / height;
  if (aspect > BACKGROUND_BLUR_ASPECT_THRESHOLD) {
    return true;
  }

  return isNonVerticalCanvasVideo(width, height);
}

/** Cover scale relative to contain-fit for filling a 9:16 canvas with the source footage. */
export function computeBackgroundCoverScale(sourceWidth: number, sourceHeight: number): number {
  const fitWidth = CAPCUT_CANVAS_WIDTH / sourceWidth;
  const fitHeight = CAPCUT_CANVAS_HEIGHT / sourceHeight;
  const contain = Math.min(fitWidth, fitHeight);
  const cover = Math.max(fitWidth, fitHeight);

  if (contain <= 0) {
    return 1;
  }

  return Number((cover / contain).toFixed(4));
}
