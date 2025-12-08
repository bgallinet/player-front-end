
const primaryColor = '#fe4462';
const secondaryColor = '#028cd5';
const tertiaryColor = '#8cd2ec';
const backgroundColor = '#000000';
const secondaryBackgroundColor = '#0C0C0C';

const marginNumber = 0.8;
const navigationWidthNumber = 14;
const buttonHeightNumber = 4;
const buttonPaddingNumber = 0.625;

const margin = `${marginNumber}rem`;
const buttonHeight = `${buttonHeightNumber}rem`;
const navigationWidth = `${navigationWidthNumber}rem`;
const padding = `${buttonPaddingNumber}rem ${buttonPaddingNumber*2}rem`;
const buttonPadding = `${buttonPaddingNumber}rem ${buttonPaddingNumber*2}rem`;
const roundedCornersRadius = '0.5rem';

const secMenuWidthNumber = navigationWidthNumber;
const secMenuUserWidthNumber = secMenuWidthNumber+5;

// Scan frequencies for different detection types
const scanFrequencyEmotion = 200; // in milliseconds - emotion detection scan rate
const scanFrequencyLandmark = 200; // in milliseconds - facial landmark detection scan rate
const scanFrequencyPose = 200; // in milliseconds - body pose detection scan rate (slower due to higher computational cost, ~100ms processing time)

// Legacy - kept for backward compatibility
const scanFrequency = scanFrequencyEmotion;

const noddingAnalysisWindow = 3000; // in milliseconds
const apiSendInterval = 2000; // in milliseconds
const reactionMapperUpdateInterval = 500; // in milliseconds - how often ReactionToSoundMapper generates recommendations
const landmarkDataUploadInterval = 1000; // in milliseconds - how often facial landmark data is sent to server and stored in localStorage

// Thresholds for facial reactions visualization and status determination
const thresholdForVisualizationOfNodding = 0.005;
const thresholdForVisualizationOfSmiling = 0.1;
const thresholdForVisualizationOfJawOpen = 0.1;

// Stability threshold: number of consecutive frames without face detection before clearing emotion data
const noFaceFramesThreshold = 2;

// refreshTime is the time interval between each data fetch from database and refresh of the UI
const refreshTime = 2000; // in milliseconds
const refreshTimeLandmarks = 250; // in milliseconds
const refreshTimePositionLandmarksDisplay = 10000; // in milliseconds

// Live cam display configuration
const liveCamDisplayRows = 3; // Number of rows in the grid layout for live cam display
const liveCamDisplayMaxUsers = liveCamDisplayRows * liveCamDisplayRows; // Maximum number of users to display (grid squared)

export { 
    refreshTime, refreshTimeLandmarks, refreshTimePositionLandmarksDisplay, 
    scanFrequency, scanFrequencyEmotion, scanFrequencyLandmark, scanFrequencyPose,
    noddingAnalysisWindow, primaryColor, secondaryColor, tertiaryColor, margin, navigationWidth, padding,
    buttonHeight, buttonPadding, marginNumber, navigationWidthNumber, buttonHeightNumber,
    buttonPaddingNumber, roundedCornersRadius, secMenuWidthNumber, secMenuUserWidthNumber,
    backgroundColor, secondaryBackgroundColor, apiSendInterval, thresholdForVisualizationOfNodding,
    thresholdForVisualizationOfSmiling, thresholdForVisualizationOfJawOpen,
    noFaceFramesThreshold, reactionMapperUpdateInterval, landmarkDataUploadInterval,
    liveCamDisplayRows, liveCamDisplayMaxUsers
};
