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

/**
 * Get color from transition table based on remaining ratio
 * Supports negative ratios for negative time (beyond zero)
 * @param {number} remainingRatio - Ratio of time remaining (can be negative for overtime)
 * @returns {string} Hex color string
 */
function getColorForRemainingRatio(remainingRatio) {
    // Smooth color transition: Blue→Cyan→Green→Yellow→Orange→Red→Violet→Deep Violet
    const defaultTable = [
        { ratio: 1.0, color: '#0088ff' },   // Blue: 100% remaining
        { ratio: 0.9, color: '#00aaff' },   // Blue-Cyan: 90%
        { ratio: 0.8, color: '#00ccff' },   // Cyan-Blue: 80%
        { ratio: 0.75, color: '#00ff00' },  // Green: 75%
        { ratio: 0.6, color: '#80ff00' },   // Lime-Green: 60%
        { ratio: 0.5, color: '#ffff00' },   // Yellow: 50%
        { ratio: 0.4, color: '#ffcc00' },   // Yellow-Orange: 40%
        { ratio: 0.3, color: '#ffaa00' },   // Orange-Yellow: 30%
        { ratio: 0.25, color: '#ff8800' },  // Orange: 25%
        { ratio: 0.2, color: '#ff6600' },   // Orange-Red: 20%
        { ratio: 0.1, color: '#ff4400' },   // Red-Orange: 10%
        { ratio: 0.0, color: '#ff0000' },   // Red: 0% (zero)
        { ratio: -0.25, color: '#ff0080' }, // Red-Magenta: -25%
        { ratio: -0.5, color: '#ee82ee' },  // Violet: -50%
        { ratio: -0.75, color: '#c060ff' }, // Violet-Purple: -75%
        { ratio: -1.0, color: '#8b00ff' }   // Deep Violet: -100%
    ];

    // Use the color transition table from config
    const table = COLOR_TRANSITION_TABLE || defaultTable;

    // Sort table by ratio (descending)
    const sortedTable = [...table].sort((a, b) => b.ratio - a.ratio);

    // Find the two entries that bracket our ratio
    for (let i = 0; i < sortedTable.length - 1; i++) {
        const entry1 = sortedTable[i];
        const entry2 = sortedTable[i + 1];

        if (remainingRatio <= entry1.ratio && remainingRatio >= entry2.ratio) {
            // Calculate interpolation factor (0 to 1)
            const range = entry1.ratio - entry2.ratio;
            const t = range === 0 ? 0 : (entry1.ratio - remainingRatio) / range;

            // Interpolate between the two colors
            return lerpColor(entry1.color, entry2.color, t);
        }
    }

    // If ratio is outside all ranges, return the edge color
    if (remainingRatio > sortedTable[0].ratio) {
        return sortedTable[0].color;
    }
    return sortedTable[sortedTable.length - 1].color;
}
