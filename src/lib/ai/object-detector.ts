import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

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
const MIN_CONFIDENCE = 0.75;

let model: cocoSsd.ObjectDetection | null = null;
let isLoading = false;

export async function initObjectDetector(): Promise<void> {
  if (model || isLoading) return;

  isLoading = true;
  try {
    model = await cocoSsd.load({
      base: 'lite_mobilenet_v2',
    });
  } finally {
    isLoading = false;
  }
}

export async function detectObjects(
  videoElement: HTMLVideoElement | HTMLCanvasElement
): Promise<ObjectDetectionResult> {
  if (!model) {
    return {
      suspiciousObjects: [],
      hasSuspiciousObject: false,
    };
  }

  const predictions = await model.detect(videoElement);

  const suspiciousObjects: DetectedObject[] = predictions
    .filter((prediction) => {
      const isProhibited = PROHIBITED_OBJECTS.includes(prediction.class);
      const hasHighConfidence = prediction.score >= MIN_CONFIDENCE;
      return isProhibited && hasHighConfidence;
    })
    .map((prediction) => ({
      class: prediction.class,
      score: prediction.score,
      bbox: prediction.bbox as [number, number, number, number],
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
