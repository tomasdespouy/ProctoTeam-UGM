// NOTE: @mediapipe/face_mesh uses `navigator` at module level and cannot be
// imported statically with Turbopack. We use dynamic import inside initFaceDetector
// (browser-only) to avoid the build error.

export interface FaceDetectionResult {
  faceCount: number;
  headPose: {
    yaw: number;
    pitch: number;
    roll: number;
  } | null;
  isLookingAway: boolean;
}

const YAW_THRESHOLD   = 30;
const PITCH_THRESHOLD = 25;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceMeshInstance: any | null = null;
let isInitialized                = false;

// Concurrency lock: prevents multiple send() calls from being in-flight
// simultaneously, which causes onResults to fire for the wrong Promise.
let isProcessing = false;

export async function initFaceDetector(): Promise<void> {
  if (isInitialized && faceMeshInstance) return;

  // Dynamic import keeps this out of the SSR/Turbopack static bundle.
  // The package loads its WASM assets from jsDelivr CDN via locateFile.
  const { FaceMesh } = await import('@mediapipe/face_mesh');

  faceMeshInstance = new FaceMesh({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMeshInstance.setOptions({
    maxNumFaces:            3,
    refineLandmarks:        true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
  });

  isInitialized = true;
}

/**
 * Analyse one video frame and return face-detection results.
 *
 * FIX (Bug #3 — original): Wrapped send() in a Promise that resolves on onResults.
 *
 * FIX (Bug #3 — race condition): MediaPipe's onResults is a PERSISTENT listener
 * (setter, not additive). If send() for frame N takes >500 ms, frame N+1 overwrites
 * onResults and frame N's completion resolves frame N+1's Promise with stale data.
 *
 * Resolution:
 *   1. `isProcessing` lock — skips the frame if a previous send() is still in-flight,
 *      preventing concurrent calls entirely.
 *   2. `settled` flag — ensures a given Promise resolves exactly once, even if
 *      onResults somehow fires multiple times for the same send().
 *   3. All three exit paths (onResults, timeout, catch) release the lock.
 */
export async function detectFaces(videoElement: HTMLVideoElement): Promise<FaceDetectionResult> {
  const EMPTY: FaceDetectionResult = { faceCount: 0, headPose: null, isLookingAway: false };

  if (!faceMeshInstance || !isInitialized) return EMPTY;

  // Skip this frame if the previous one hasn't finished — no concurrent sends.
  if (isProcessing) return EMPTY;
  isProcessing = true;

  return new Promise<FaceDetectionResult>((resolve) => {
    // Guard: ensures this Promise settles exactly once across all exit paths.
    let settled = false;
    const settle = (result: FaceDetectionResult) => {
      if (settled) return;
      settled      = true;
      isProcessing = false;
      resolve(result);
    };

    // Safety valve: release lock and resolve empty if onResults never fires.
    const timeout = setTimeout(() => {
      console.debug('[FaceMesh] Timeout — no onResults within 3 s');
      settle(EMPTY);
    }, 3000);

    // One-shot results handler for this specific frame.
    faceMeshInstance.onResults((results: any) => {
      clearTimeout(timeout);

      if (!results?.multiFaceLandmarks) {
        settle(EMPTY);
        return;
      }

      const faceCount = results.multiFaceLandmarks.length;

      console.debug(
        '[FaceMesh] faceCount:', faceCount,
        '| video:', videoElement.videoWidth, '×', videoElement.videoHeight,
        '| width attr:', videoElement.width,
      );

      if (faceCount === 0) {
        settle(EMPTY);
        return;
      }

      const landmarks     = results.multiFaceLandmarks[0];
      const headPose      = estimateHeadPose(landmarks);
      const isLookingAway =
        Math.abs(headPose.yaw)   > YAW_THRESHOLD ||
        Math.abs(headPose.pitch) > PITCH_THRESHOLD;

      settle({ faceCount, headPose, isLookingAway });
    });

    // Kick off the analysis; release lock immediately if send() itself throws.
    faceMeshInstance.send({ image: videoElement }).catch(() => {
      clearTimeout(timeout);
      settle(EMPTY);
    });
  });
}

function estimateHeadPose(
  landmarks: { x: number; y: number; z: number }[]
): { yaw: number; pitch: number; roll: number } {
  const noseTip       = landmarks[1];
  const leftEyeOuter  = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const chin          = landmarks[152];
  const forehead      = landmarks[10];

  const eyeDistance = Math.sqrt(
    Math.pow(rightEyeOuter.x - leftEyeOuter.x, 2) +
    Math.pow(rightEyeOuter.y - leftEyeOuter.y, 2)
  );

  const eyeMidpoint = {
    x: (leftEyeOuter.x + rightEyeOuter.x) / 2,
    y: (leftEyeOuter.y + rightEyeOuter.y) / 2,
  };

  const yawOffset = (noseTip.x - eyeMidpoint.x) / eyeDistance;
  const yaw       = yawOffset * 90;

  const faceHeight = Math.sqrt(
    Math.pow(forehead.x - chin.x, 2) +
    Math.pow(forehead.y - chin.y, 2)
  );

  const noseToEyeRatio = (noseTip.y - eyeMidpoint.y) / faceHeight;
  const pitch          = (noseToEyeRatio - 0.3) * 150;

  const eyeDeltaY = rightEyeOuter.y - leftEyeOuter.y;
  const roll      = Math.atan2(eyeDeltaY, rightEyeOuter.x - leftEyeOuter.x) * (180 / Math.PI);

  return {
    yaw:   Math.max(-90, Math.min(90,  yaw)),
    pitch: Math.max(-90, Math.min(90,  pitch)),
    roll:  Math.max(-45, Math.min(45,  roll)),
  };
}

export function disposeFaceDetector(): void {
  isProcessing = false; // release lock in case it was held during disposal
  if (faceMeshInstance) {
    faceMeshInstance.close();
    faceMeshInstance = null;
    isInitialized    = false;
  }
}
