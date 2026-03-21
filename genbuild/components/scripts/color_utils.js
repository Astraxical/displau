function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 255, b: 0 };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function lerpColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    return rgbToHex(
        c1.r + (c2.r - c1.r) * t,
        c1.g + (c2.g - c1.g) * t,
        c1.b + (c2.b - c1.b) * t
    );
}

function getColorForRemainingRatio(remainingRatio) {
    // remainingRatio: 1 = full time (green), 0 = no time (red)
    const green = { r: 0, g: 255, b: 0 };
    const red = { r: 255, g: 0, b: 0 };

    return rgbToHex(
        green.r + (red.r - green.r) * (1 - remainingRatio),
        green.g + (red.g - green.g) * (1 - remainingRatio),
        green.b + (red.b - green.b) * (1 - remainingRatio)
    );
}
