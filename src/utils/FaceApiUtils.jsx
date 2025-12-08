import * as faceapi from '@vladmandic/face-api';
import { useState, useEffect } from 'react';

// Model URLs relative to public directory
const MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';

// Update to use specific model paths with weights
export const MODEL_URLS = {
  tinyFaceDetector: `${MODEL_URL}/tiny_face_detector.json`,
  faceLandmark68: `${MODEL_URL}/face_landmark_68.json`, 
  faceExpression: `${MODEL_URL}/face_expression.json`
};

// Configure face detector options
export const FACE_DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 5*32,
  scoreThreshold: 0.5
});

const verifyModelFile = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  const blob = await response.blob();
  console.log(`Model file ${url} size: ${blob.size} bytes`);
  return blob.size > 0;
};

// Model loading utility
export const loadModels = async () => {
  try {
    console.log('Loading models from:', MODEL_URL);
    
    // Verify model files before loading
    const files = [
      'tiny_face_detector_model-weights_manifest.json',
      'tiny_face_detector_model.bin',
      'face_landmark_68_model-weights_manifest.json',
      'face_landmark_68_model.bin',
      'face_expression_model-weights_manifest.json',
      'face_expression_model.bin'
    ];

    for (const file of files) {
      await verifyModelFile(`${MODEL_URL}/${file}`);
    }

    // Load tiny face detector first
    console.log('Loading tiny face detector...');
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    
    // Verify it's loaded correctly
    if (!faceapi.nets.tinyFaceDetector.isLoaded) {
      throw new Error('Failed to load tiny face detector');
    }
    
    // Load and verify face landmark model
    console.log('Loading face landmark model...');
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    if (!faceapi.nets.faceLandmark68Net.isLoaded) {
      throw new Error('Failed to load face landmark model');
    }
    console.log('Face landmark model loaded successfully');
    
    // Load and verify face expression model
    console.log('Loading face expression model...');
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    if (!faceapi.nets.faceExpressionNet.isLoaded) {
      throw new Error('Failed to load face expression model');
    }
    console.log('Face expression model loaded successfully');

    // Only show success message after all models are verified
    if (faceapi.nets.tinyFaceDetector.isLoaded && 
        faceapi.nets.faceLandmark68Net.isLoaded && 
        faceapi.nets.faceExpressionNet.isLoaded) {
      console.log('All models loaded successfully');
      return true;
    } else {
      throw new Error('Some models failed to load properly');
    }
  } catch (error) {
    console.error('Error loading face-api.js models:', error);
    throw error;
  }
};

// Model loading state management
export const useModelLoading = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeModels = async () => {
      try {
        setIsLoading(true);
        setIsError(false);
        await loadModels();
        setIsReady(true);
      } catch (error) {
        console.error('Error initializing models:', error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializeModels();

    return () => {
      // Cleanup if needed
      setIsReady(false);
    };
  }, []);

  return { isLoading, isError, isReady };
}; 