import { FaceMesh, Results as FaceMeshResults } from '@mediapipe/face_mesh';

export interface FaceDetectionResult {
  faceCount: number;
  headPose: {
    yaw: number;
    pitch: number;
    roll: number;
  } | null;
  isLookingAway: boolean;
}

const YAW_THRESHOLD = 30;
const PITCH_THRESHOLD = 25;

let faceMeshInstance: FaceMesh | null = null;
let isInitialized = false;
let latestResults: FaceMeshResults | null = null;

export async function initFaceDetector(): Promise<void> {
  if (isInitialized && faceMeshInstance) return;

  faceMeshInstance = new FaceMesh({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    },
  });

  faceMeshInstance.setOptions({
    maxNumFaces: 3,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMeshInstance.onResults((results) => {
    latestResults = results;
  });

  isInitialized = true;
}

export async function detectFaces(videoElement: HTMLVideoElement): Promise<FaceDetectionResult> {
  if (!faceMeshInstance || !isInitialized) {
    return {
      faceCount: 0,
      headPose: null,
      isLookingAway: false,
    };
  }

  await faceMeshInstance.send({ image: videoElement });

  if (!latestResults || !latestResults.multiFaceLandmarks) {
    return {
      faceCount: 0,
      headPose: null,
      isLookingAway: false,
    };
  }

  const faceCount = latestResults.multiFaceLandmarks.length;

  if (faceCount === 0) {
    return {
      faceCount: 0,
      headPose: null,
      isLookingAway: false,
    };
  }

  const landmarks = latestResults.multiFaceLandmarks[0];
  const headPose = estimateHeadPose(landmarks);
  const isLookingAway = Math.abs(headPose.yaw) > YAW_THRESHOLD || Math.abs(headPose.pitch) > PITCH_THRESHOLD;

  return {
    faceCount,
    headPose,
    isLookingAway,
  };
}

function estimateHeadPose(landmarks: { x: number; y: number; z: number }[]): {
  yaw: number;
  pitch: number;
  roll: number;
} {
  const noseTip = landmarks[1];
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const chin = landmarks[152];
  const forehead = landmarks[10];

  const eyeDistance = Math.sqrt(
    Math.pow(rightEyeOuter.x - leftEyeOuter.x, 2) +
    Math.pow(rightEyeOuter.y - leftEyeOuter.y, 2)
  );

  const eyeMidpoint = {
    x: (leftEyeOuter.x + rightEyeOuter.x) / 2,
    y: (leftEyeOuter.y + rightEyeOuter.y) / 2,
  };

  const yawOffset = (noseTip.x - eyeMidpoint.x) / eyeDistance;
  const yaw = yawOffset * 90;

  const faceHeight = Math.sqrt(
    Math.pow(forehead.x - chin.x, 2) +
    Math.pow(forehead.y - chin.y, 2)
  );

  const noseToEyeRatio = (noseTip.y - eyeMidpoint.y) / faceHeight;
  const pitch = (noseToEyeRatio - 0.3) * 150;

  const eyeDeltaY = rightEyeOuter.y - leftEyeOuter.y;
  const roll = Math.atan2(eyeDeltaY, rightEyeOuter.x - leftEyeOuter.x) * (180 / Math.PI);

  return {
    yaw: Math.max(-90, Math.min(90, yaw)),
    pitch: Math.max(-90, Math.min(90, pitch)),
    roll: Math.max(-45, Math.min(45, roll)),
  };
}

export function disposeFaceDetector(): void {
  if (faceMeshInstance) {
    faceMeshInstance.close();
    faceMeshInstance = null;
    isInitialized = false;
    latestResults = null;
  }
}
