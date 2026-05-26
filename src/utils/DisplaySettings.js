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
const padding = `${buttonPaddingNumber}rem ${buttonPaddingNumber * 2}rem`;
const buttonPadding = `${buttonPaddingNumber}rem ${buttonPaddingNumber * 2}rem`;
const roundedCornersRadius = '0.5rem';

const secMenuWidthNumber = navigationWidthNumber;
const secMenuUserWidthNumber = secMenuWidthNumber + 5;

const scanFrequencyEmotion = 200;
const scanFrequencyLandmark = 200;
const scanFrequencyPose = 200;

const scanFrequency = scanFrequencyEmotion;

const noddingAnalysisWindow = 3000;
const apiSendInterval = 2000;
const reactionMapperUpdateInterval = 500;

const thresholdForVisualizationOfNodding = 0.005;
const thresholdForVisualizationOfSmiling = 0.1;
const thresholdForVisualizationOfJawOpen = 0.1;

const noFaceFramesThreshold = 2;

const refreshTime = 2000;
const refreshTimeLandmarks = 250;
const refreshTimePositionLandmarksDisplay = 10000;

const liveCamDisplayRows = 3;
const liveCamDisplayMaxUsers = liveCamDisplayRows * liveCamDisplayRows;

export {
    refreshTime,
    refreshTimeLandmarks,
    refreshTimePositionLandmarksDisplay,
    scanFrequency,
    scanFrequencyEmotion,
    scanFrequencyLandmark,
    scanFrequencyPose,
    noddingAnalysisWindow,
    primaryColor,
    secondaryColor,
    tertiaryColor,
    margin,
    navigationWidth,
    padding,
    buttonHeight,
    buttonPadding,
    marginNumber,
    navigationWidthNumber,
    buttonHeightNumber,
    buttonPaddingNumber,
    roundedCornersRadius,
    secMenuWidthNumber,
    secMenuUserWidthNumber,
    backgroundColor,
    secondaryBackgroundColor,
    apiSendInterval,
    thresholdForVisualizationOfNodding,
    thresholdForVisualizationOfSmiling,
    thresholdForVisualizationOfJawOpen,
    noFaceFramesThreshold,
    reactionMapperUpdateInterval,
    liveCamDisplayRows,
    liveCamDisplayMaxUsers,
};
