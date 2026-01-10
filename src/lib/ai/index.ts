export {
  initFaceDetector,
  detectFaces,
  disposeFaceDetector,
  type FaceDetectionResult,
} from './face-detector';

export {
  initObjectDetector,
  detectObjects,
  disposeObjectDetector,
  isModelLoaded,
  type ObjectDetectionResult,
  type DetectedObject,
} from './object-detector';

export {
  initAICoordinator,
  startDetection,
  stopDetection,
  disposeAICoordinator,
  getDetectionStatus,
  type AIAlert,
  type AlertType,
  type AICoordinatorCallbacks,
} from './ai-coordinator';
