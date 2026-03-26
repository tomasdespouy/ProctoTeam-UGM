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
 * FIX (Bug #3): The original code registered a persistent `onResults` handler
 * that wrote to a shared `latestResults` variable, then called `send()` and
 * immediately read that variable — creating a race condition where `send()`
 * could resolve before the callback fired, always returning stale/null data.
 *
 * Now we wrap each `send()` call in a fresh Promise that only resolves once
 * MediaPipe fires `onResults` for *that specific frame*.  A 3 s safety timeout
 * prevents hanging if MediaPipe never calls back.
 */
export async function detectFaces(videoElement: HTMLVideoElement): Promise<FaceDetectionResult> {
  const EMPTY: FaceDetectionResult = { faceCount: 0, headPose: null, isLookingAway: false };

  if (!faceMeshInstance || !isInitialized) return EMPTY;

  return new Promise<FaceDetectionResult>((resolve) => {
    // Safety valve: if onResults never fires within 3 s, resolve with empty.
    const timeout = setTimeout(() => resolve(EMPTY), 3000);

    // Register a one-shot handler for this frame's results.
    faceMeshInstance.onResults((results: any) => {
      clearTimeout(timeout);

      if (!results?.multiFaceLandmarks) {
        resolve(EMPTY);
        return;
      }

      const faceCount = results.multiFaceLandmarks.length;

      if (faceCount === 0) {
        resolve(EMPTY);
        return;
      }

      const landmarks    = results.multiFaceLandmarks[0];
      const headPose     = estimateHeadPose(landmarks);
      const isLookingAway =
        Math.abs(headPose.yaw)   > YAW_THRESHOLD ||
        Math.abs(headPose.pitch) > PITCH_THRESHOLD;

      resolve({ faceCount, headPose, isLookingAway });
    });

    // Kick off the analysis; if send() itself throws, resolve empty.
    faceMeshInstance.send({ image: videoElement }).catch(() => {
      clearTimeout(timeout);
      resolve(EMPTY);
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
  if (faceMeshInstance) {
    faceMeshInstance.close();
    faceMeshInstance = null;
    isInitialized    = false;
  }
}
