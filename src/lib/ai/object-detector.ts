// All TF.js imports are dynamic (inside initObjectDetector) to prevent
// Turbopack/SSR crashes — TensorFlow touches browser-only APIs (WebGL,
// document, navigator) at module evaluation time, which fails on the server.

export interface ObjectDetectionResult {
  suspiciousObjects: DetectedObject[];
  hasSuspiciousObject: boolean;
}

export interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

const PROHIBITED_OBJECTS = ['cell phone'];
const MIN_CONFIDENCE = 0.45;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any | null = null;
let isLoading = false;

export async function initObjectDetector(): Promise<void> {
  if (model || isLoading) return;

  isLoading = true;
  try {
    // Dynamic imports — only executed in the browser, never during SSR/Turbopack
    // bundling. This mirrors the pattern used in face-detector.ts for MediaPipe.
    await import('@tensorflow/tfjs');
    const cocoSsd = await import('@tensorflow-models/coco-ssd');

    model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  } finally {
    isLoading = false;
  }
}

export async function detectObjects(
  videoElement: HTMLVideoElement | HTMLCanvasElement
): Promise<ObjectDetectionResult> {
  if (!model) {
    return { suspiciousObjects: [], hasSuspiciousObject: false };
  }

  const predictions = await model.detect(videoElement);

  console.debug(
    '[COCO-SSD] Raw predictions:',
    predictions.length
      ? predictions.map((p: any) => `${p.class}@${p.score.toFixed(2)}`).join(', ')
      : '(none)',
  );

  const suspiciousObjects: DetectedObject[] = predictions
    .filter((p: any) => PROHIBITED_OBJECTS.includes(p.class) && p.score >= MIN_CONFIDENCE)
    .map((p: any) => ({
      class: p.class,
      score: p.score,
      bbox: p.bbox as [number, number, number, number],
    }));

  return {
    suspiciousObjects,
    hasSuspiciousObject: suspiciousObjects.length > 0,
  };
}

export function isModelLoaded(): boolean {
  return model !== null;
}

export function disposeObjectDetector(): void {
  if (model) {
    model.dispose();
    model = null;
  }
}
