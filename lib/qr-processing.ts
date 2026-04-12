/**
 * QR Code Processing Utilities
 * Provides robust image enhancement and multi-resolution scanning tools
 * to improve QR detection accuracy in poor lighting/positioning conditions
 */

/**
 * Interface for multi-resolution scan configuration
 */
export interface ScanResolution {
  width: number;
  height: number;
  priority: number; // Lower number = higher priority
}

/**
 * Standard scan resolutions from high to low priority
 * Primary (960x720): Fast path, catches most codes
 * Secondary (1200x900): Catches distant QR codes
 * Fallback (600x480): Catches very close/tilted codes
 */
export const SCAN_RESOLUTIONS: ScanResolution[] = [
  { width: 960, height: 720, priority: 1 },  // Primary - fast path
  { width: 1200, height: 900, priority: 2 }, // Secondary - distant codes
  { width: 600, height: 480, priority: 3 },  // Fallback - close/tilted
];

/**
 * Enhances image brightness by normalizing pixel values
 * Helps detect QR codes in low-light conditions
 *
 * @param imageData - Canvas ImageData object
 * @param factor - Enhancement factor (1.0 = no change, 1.5 = 50% brighter)
 * @returns Enhanced ImageData
 */
export function enhanceBrightness(
  imageData: ImageData,
  factor: number = 1.4
): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const length = data.length;

  // Process each pixel (skip alpha channel)
  for (let i = 0; i < length; i += 4) {
    // Only enhance RGB, keep alpha
    data[i] = Math.min(255, data[i] * factor);       // R
    data[i + 1] = Math.min(255, data[i + 1] * factor); // G
    data[i + 2] = Math.min(255, data[i + 2] * factor); // B
    // data[i + 3] stays unchanged (alpha)
  }

  return new ImageData(data, imageData.width, imageData.height);
}

/**
 * Enhances image contrast to make QR code edges sharper
 * Helps detect tilted or partially obscured QR codes
 *
 * @param imageData - Canvas ImageData object
 * @param factor - Contrast factor (1.0 = no change, 1.5 = 50% more contrast)
 * @returns Enhanced ImageData
 */
export function enhanceContrast(
  imageData: ImageData,
  factor: number = 1.3
): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const length = data.length;
  const centerPoint = 128; // Midpoint of 0-255 range

  // Process each pixel
  for (let i = 0; i < length; i += 4) {
    // Adjust RGB around center point
    data[i] = Math.min(255, Math.max(0, (data[i] - centerPoint) * factor + centerPoint));           // R
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - centerPoint) * factor + centerPoint)); // G
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - centerPoint) * factor + centerPoint)); // B
    // data[i + 3] stays unchanged (alpha)
  }

  return new ImageData(data, imageData.width, imageData.height);
}

/**
 * Calculates image quality score based on luminance variance
 * Higher variance = more likely to contain detectable QR code
 *
 * @param imageData - Canvas ImageData object
 * @returns Quality score 0-100
 */
export function calculateImageQuality(imageData: ImageData): number {
  const data = imageData.data;
  const length = data.length;
  let sumBrightness = 0;
  let pixelCount = 0;

  // Calculate average brightness (Y in YCbCr)
  for (let i = 0; i < length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
    sumBrightness += brightness;
    pixelCount++;
  }

  const avgBrightness = sumBrightness / pixelCount;

  // Calculate variance from average
  let sumVariance = 0;
  for (let i = 0; i < length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
    const diff = brightness - avgBrightness;
    sumVariance += diff * diff;
  }

  const variance = sumVariance / pixelCount;
  // Normalize variance to 0-100 score
  // Higher variance = higher QR detectability
  // Max useful variance is around 5000 (with full range 0-255)
  const qualityScore = Math.min(100, (variance / 50));

  return Math.round(qualityScore);
}

/**
 * Interpolates image to a new resolution while preserving quality
 * Uses nearest-neighbor for speed when scaling canvas frames
 *
 * @param sourceCanvas - Source canvas with image
 * @param targetWidth - Target width
 * @param targetHeight - Target height
 * @returns New canvas with resized image
 */
export function interpolateCanvasImage(
  sourceCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;

  const ctx = targetCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return targetCanvas;

  // Use nearest-neighbor scaling for speed (better for QR codes than blur)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  return targetCanvas;
}

/**
 * Creates a copy of ImageData with optional enhancement
 * Used for safe manipulation without affecting original
 *
 * @param imageData - Source ImageData
 * @returns New ImageData copy
 */
export function cloneImageData(imageData: ImageData): ImageData {
  return new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );
}

/**
 * Calculates optimal canvas size for video source
 * Maintains aspect ratio while fitting to max preferred dimension
 *
 * @param videoWidth - Source video width
 * @param videoHeight - Source video height
 * @param maxWidth - Maximum preferred width
 * @returns Object with optimal width and height
 */
export function calculateOptimalCanvasSize(
  videoWidth: number,
  videoHeight: number,
  maxWidth: number = 960
): { width: number; height: number } {
  const sourceWidth = Math.max(videoWidth, 1);
  const sourceHeight = Math.max(videoHeight, 1);
  const ratio = sourceWidth / sourceHeight;

  const targetWidth = Math.min(maxWidth, sourceWidth);
  const targetHeight = Math.max(360, Math.floor(targetWidth / Math.max(ratio, 1)));

  return { width: targetWidth, height: targetHeight };
}

/**
 * Batch processes multiple QR scanning attempts in priority order
 * Returns success + quality details for adaptive retry logic
 *
 * @param canvas - Source canvas with video frame
 * @param resolutions - Array of resolutions to attempt
 * @returns Object with attempted resolutions and their quality scores
 */
export function analyzeFrameQualityAcrossResolutions(
  canvas: HTMLCanvasElement,
  resolutions: ScanResolution[] = SCAN_RESOLUTIONS
): {
  resolutions: Array<{
    width: number;
    height: number;
    quality: number;
  }>;
  recommendedIndex: number;
} {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { resolutions: [], recommendedIndex: 0 };

  const analyzed = resolutions.map((res) => {
    // Create temp canvas at this resolution
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = res.width;
    tempCanvas.height = res.height;
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
    if (!tempCtx) return { ...res, quality: 0 };

    tempCtx.drawImage(canvas, 0, 0, res.width, res.height);
    const imageData = tempCtx.getImageData(0, 0, res.width, res.height);
    const quality = calculateImageQuality(imageData);

    return { width: res.width, height: res.height, quality };
  });

  // Find best quality resolution
  const recommendedIndex = analyzed.reduce(
    (bestIdx, current, idx) => (current.quality > analyzed[bestIdx].quality ? idx : bestIdx),
    0
  );

  return { resolutions: analyzed, recommendedIndex };
}
