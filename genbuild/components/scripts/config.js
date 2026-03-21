// ============ CONFIGURATION ============
const TARGET_TIME = '{{TARGET_TIME}}';
const MILLISECONDS_AT_FULL_BRIGHTNESS = {{DAYS_AT_FULL_BRIGHTNESS}};
// =======================================

// Calculate START_TIME as MILLISECONDS_AT_FULL_BRIGHTNESS before TARGET_TIME
const targetDate = new Date(TARGET_TIME);
const startDate = new Date(targetDate.getTime() - MILLISECONDS_AT_FULL_BRIGHTNESS);
const START_TIME = startDate.toISOString().slice(0, 19);

// Color state
let currentColor = '#00ff00';
let targetColor = '#00ff00';
let colorTransitionProgress = 1;
