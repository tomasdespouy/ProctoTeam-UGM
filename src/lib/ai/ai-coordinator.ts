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

// QA mode: thresholds reducidos para pruebas rápidas.
// Restaurar para producción: LOOKING_AWAY=5000, NO_FACE=5000, COOLDOWN=30000
const LOOKING_AWAY_THRESHOLD_MS = 2000;
const NO_FACE_THRESHOLD_MS      = 2000;
const DETECTION_INTERVAL_MS     = 500;
const ALERT_COOLDOWN_MS         = 10000;

// ─── Module-level singleton state ────────────────────────────────────────────
// FIX (Bug #2): `isRunning` and `detectionIntervalId` are module-level
// singletons. In React StrictMode, effects run twice (mount → cleanup → mount).
// If a previous detection cycle was not fully stopped before the second mount
// (e.g., initAICoordinator() threw mid-way so aiInitializedRef was never set,
// leaving isRunning=true uncleared), startDetection() would silently bail out
// on every subsequent call.
//
// Resolution:
//   1. stopDetection() always resets isRunning + clears the interval — order
//      matters: set isRunning=false FIRST so any in-flight tick sees it.
//   2. startDetection() calls stopDetection() defensively before starting so a
//      zombie interval from a previous cycle is always killed first.
//   3. StudentCam.tsx's AI-cleanup useEffect was updated to call stopDetection()
//      unconditionally (not gated by aiInitializedRef) to prevent leaving a
//      partially-initialised module in a bad state.

let isRunning        = false;
let detectionIntervalId: NodeJS.Timeout | null = null;

let violationState: ViolationState = createViolationState();

function createViolationState(): ViolationState {
  return {
    lookingAwayStartTime:    null,
    noFaceStartTime:         null,
    lookingAwayAlertSent:    false,
    noFaceAlertSent:         false,
    multipleFacesLastAlert:  0,
    prohibitedObjectLastAlert: 0,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

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
  // Defensive stop: kill any zombie interval left from a previous (partial)
  // cycle before starting a fresh one.  This guarantees the module always
  // enters a known-clean state regardless of how the previous cycle ended.
  stopDetection();

  isRunning      = true;
  violationState = createViolationState();

  detectionIntervalId = setInterval(async () => {
    // Re-check isRunning inside the tick so a stopDetection() call that
    // happens between tick scheduling and tick execution is honoured.
    if (!isRunning) return;

    try {
      const [faceResult, objectResult] = await Promise.all([
        detectFaces(videoElement),
        detectObjects(videoElement),
      ]);

      if (!isRunning) return; // guard against late resolution after stop

      console.debug(
        '[AI Coordinator] tick — faces:', faceResult.faceCount,
        '| suspicious objects:', objectResult.suspiciousObjects.length,
        '| isRunning:', isRunning,
      );

      processDetectionResults(faceResult, objectResult, callbacks);
    } catch (error) {
      console.error('[AI Coordinator] Detection error:', error);
    }
  }, DETECTION_INTERVAL_MS);
}

export function stopDetection(): void {
  // Set isRunning FIRST so in-flight async ticks see the stop signal before
  // we clear the interval handle.
  isRunning = false;

  if (detectionIntervalId !== null) {
    clearInterval(detectionIntervalId);
    detectionIntervalId = null;
  }

  violationState = createViolationState();
}

export function disposeAICoordinator(): void {
  stopDetection();
  disposeFaceDetector();
  disposeObjectDetector();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function processDetectionResults(
  faceResult: FaceDetectionResult,
  objectResult: ObjectDetectionResult,
  callbacks: AICoordinatorCallbacks
): void {
  const now = Date.now();

  // ── Multiple faces ──────────────────────────────────────────────────────────
  if (faceResult.faceCount > 1) {
    if (now - violationState.multipleFacesLastAlert >= ALERT_COOLDOWN_MS) {
      callbacks.onAlert({
        type:        'multiple_faces',
        severity:    'critical',
        description: `Se detectaron ${faceResult.faceCount} personas en la cámara`,
        details:     { faceCount: faceResult.faceCount },
      });
      callbacks.onRequestSnapshot('multiple_faces_detected');
      violationState.multipleFacesLastAlert = now;
    }
  }

  // ── No face ─────────────────────────────────────────────────────────────────
  if (faceResult.faceCount === 0) {
    if (violationState.noFaceStartTime === null) {
      violationState.noFaceStartTime = now;
    } else if (!violationState.noFaceAlertSent) {
      const elapsed = now - violationState.noFaceStartTime;
      if (elapsed >= NO_FACE_THRESHOLD_MS) {
        callbacks.onAlert({
          type:        'no_face',
          severity:    'high',
          description: 'Usuario ausente de la cámara',
          details:     { durationMs: elapsed },
        });
        callbacks.onRequestSnapshot('no_face_detected');
        violationState.noFaceAlertSent = true;
      }
    }
  } else {
    violationState.noFaceStartTime = null;
    violationState.noFaceAlertSent = false;
  }

  // ── Looking away ────────────────────────────────────────────────────────────
  if (faceResult.faceCount === 1 && faceResult.isLookingAway) {
    if (violationState.lookingAwayStartTime === null) {
      violationState.lookingAwayStartTime = now;
    } else if (!violationState.lookingAwayAlertSent) {
      const elapsed = now - violationState.lookingAwayStartTime;
      if (elapsed >= LOOKING_AWAY_THRESHOLD_MS) {
        callbacks.onAlert({
          type:        'looking_away',
          severity:    'medium',
          description: 'El estudiante desvió la mirada por tiempo prolongado',
          details:     { durationMs: elapsed, headPose: faceResult.headPose },
        });
        callbacks.onRequestSnapshot('looking_away_detected');
        violationState.lookingAwayAlertSent = true;
      }
    }
  } else {
    violationState.lookingAwayStartTime = null;
    violationState.lookingAwayAlertSent = false;
  }

  // ── Prohibited objects ──────────────────────────────────────────────────────
  if (objectResult.hasSuspiciousObject) {
    if (now - violationState.prohibitedObjectLastAlert >= ALERT_COOLDOWN_MS) {
      for (const obj of objectResult.suspiciousObjects) {
        callbacks.onAlert({
          type:        'prohibited_object',
          severity:    'critical',
          description: `Objeto prohibido detectado: ${obj.class}`,
          details:     { objectClass: obj.class, confidence: obj.score, bbox: obj.bbox },
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
  return { isRunning, violationState: { ...violationState } };
}
