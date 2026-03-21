function setTargetColor(color) {
    targetColor = color;
    colorTransitionProgress = 0;
}

function updateColorTransition() {
    const remainingRatio = calculateRemainingRatio();
    const calculatedColor = getColorForRemainingRatio(remainingRatio);

    if (calculatedColor !== targetColor) {
        setTargetColor(calculatedColor);
    }

    if (colorTransitionProgress < 1) {
        colorTransitionProgress += 0.1;
        if (colorTransitionProgress > 1) colorTransitionProgress = 1;

        currentColor = lerpColor(currentColor, targetColor, colorTransitionProgress);

        if (colorTransitionProgress >= 1) {
            currentColor = targetColor;
        }

        applyColor(currentColor);
    }
}
