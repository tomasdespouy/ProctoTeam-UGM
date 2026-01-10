import { initFaceDetector, detectFaces, disposeFaceDetector, FaceDetectionResult } from './face-detector';
import { initObjectDetector, detectObjects, disposeObjectDetector, ObjectDetectionResult } from './object-detector';

export type AlertType = 
  | 'multiple_faces'
  | 'no_face'
  | 'looking_away'
  | 'prohibited_object';

export interface AIAlert {
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details?: Record<string, unknown>;
}

export interface AICoordinatorCallbacks {
  onAlert: (alert: AIAlert) => void;
  onRequestSnapshot: (reason: string) => void;
}

interface ViolationState {
  lookingAwayStartTime: number | null;
  noFaceStartTime: number | null;
  lookingAwayAlertSent: boolean;
  noFaceAlertSent: boolean;
  multipleFacesLastAlert: number;
  prohibitedObjectLastAlert: number;
}

const LOOKING_AWAY_THRESHOLD_MS = 5000;
const NO_FACE_THRESHOLD_MS = 5000;
const DETECTION_INTERVAL_MS = 500;
const ALERT_COOLDOWN_MS = 30000;

let isRunning = false;
let detectionIntervalId: NodeJS.Timeout | null = null;
let violationState: ViolationState = {
  lookingAwayStartTime: null,
  noFaceStartTime: null,
  lookingAwayAlertSent: false,
  noFaceAlertSent: false,
  multipleFacesLastAlert: 0,
  prohibitedObjectLastAlert: 0,
};

export async function initAICoordinator(): Promise<void> {
  await Promise.all([
    initFaceDetector(),
    initObjectDetector(),
  ]);
}

export function startDetection(
  videoElement: HTMLVideoElement,
  callbacks: AICoordinatorCallbacks
): void {
  if (isRunning) return;

  isRunning = true;
  resetViolationState();

  detectionIntervalId = setInterval(async () => {
    if (!isRunning) return;

    try {
      const [faceResult, objectResult] = await Promise.all([
        detectFaces(videoElement),
        detectObjects(videoElement),
      ]);

      processDetectionResults(faceResult, objectResult, callbacks);
    } catch (error) {
      console.error('[AI Coordinator] Detection error:', error);
    }
  }, DETECTION_INTERVAL_MS);
}

export function stopDetection(): void {
  isRunning = false;
  if (detectionIntervalId) {
    clearInterval(detectionIntervalId);
    detectionIntervalId = null;
  }
  resetViolationState();
}

export function disposeAICoordinator(): void {
  stopDetection();
  disposeFaceDetector();
  disposeObjectDetector();
}

function resetViolationState(): void {
  violationState = {
    lookingAwayStartTime: null,
    noFaceStartTime: null,
    lookingAwayAlertSent: false,
    noFaceAlertSent: false,
    multipleFacesLastAlert: 0,
    prohibitedObjectLastAlert: 0,
  };
}

function processDetectionResults(
  faceResult: FaceDetectionResult,
  objectResult: ObjectDetectionResult,
  callbacks: AICoordinatorCallbacks
): void {
  const now = Date.now();

  if (faceResult.faceCount > 1) {
    if (now - violationState.multipleFacesLastAlert >= ALERT_COOLDOWN_MS) {
      callbacks.onAlert({
        type: 'multiple_faces',
        severity: 'critical',
        description: `Se detectaron ${faceResult.faceCount} personas en la cámara`,
        details: { faceCount: faceResult.faceCount },
      });
      callbacks.onRequestSnapshot('multiple_faces_detected');
      violationState.multipleFacesLastAlert = now;
    }
  }

  if (faceResult.faceCount === 0) {
    if (violationState.noFaceStartTime === null) {
      violationState.noFaceStartTime = now;
    } else if (!violationState.noFaceAlertSent) {
      const elapsed = now - violationState.noFaceStartTime;
      if (elapsed >= NO_FACE_THRESHOLD_MS) {
        callbacks.onAlert({
          type: 'no_face',
          severity: 'high',
          description: 'Usuario ausente de la cámara',
          details: { durationMs: elapsed },
        });
        callbacks.onRequestSnapshot('no_face_detected');
        violationState.noFaceAlertSent = true;
      }
    }
  } else {
    violationState.noFaceStartTime = null;
    violationState.noFaceAlertSent = false;
  }

  if (faceResult.faceCount === 1 && faceResult.isLookingAway) {
    if (violationState.lookingAwayStartTime === null) {
      violationState.lookingAwayStartTime = now;
    } else if (!violationState.lookingAwayAlertSent) {
      const elapsed = now - violationState.lookingAwayStartTime;
      if (elapsed >= LOOKING_AWAY_THRESHOLD_MS) {
        callbacks.onAlert({
          type: 'looking_away',
          severity: 'medium',
          description: 'El estudiante desvió la mirada por tiempo prolongado',
          details: {
            durationMs: elapsed,
            headPose: faceResult.headPose,
          },
        });
        callbacks.onRequestSnapshot('looking_away_detected');
        violationState.lookingAwayAlertSent = true;
      }
    }
  } else {
    violationState.lookingAwayStartTime = null;
    violationState.lookingAwayAlertSent = false;
  }

  if (objectResult.hasSuspiciousObject) {
    if (now - violationState.prohibitedObjectLastAlert >= ALERT_COOLDOWN_MS) {
      for (const obj of objectResult.suspiciousObjects) {
        callbacks.onAlert({
          type: 'prohibited_object',
          severity: 'critical',
          description: `Objeto prohibido detectado: ${obj.class}`,
          details: {
            objectClass: obj.class,
            confidence: obj.score,
            bbox: obj.bbox,
          },
        });
        callbacks.onRequestSnapshot(`prohibited_object:${obj.class}`);
      }
      violationState.prohibitedObjectLastAlert = now;
    }
  }
}

export function getDetectionStatus(): {
  isRunning: boolean;
  violationState: ViolationState;
} {
  return {
    isRunning,
    violationState: { ...violationState },
  };
}
