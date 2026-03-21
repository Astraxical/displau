function updateCountdown() {
    const target = new Date(TARGET_TIME).getTime();
    const now = Date.now();
    const remaining = target - now;
    const timeStr = formatTime(remaining);
    updateDisplay(timeStr);
}

// Initialize
const remainingRatio = calculateRemainingRatio();
currentColor = getColorForRemainingRatio(remainingRatio);
targetColor = currentColor;
applyColor(currentColor);
updateCountdown();
setInterval(updateCountdown, 10);
setInterval(updateColorTransition, 30);
