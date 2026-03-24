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
 * @param {number} remainingRatio - Ratio of time remaining (0.0 to 1.0)
 * @returns {string} Hex color string
 */
function getColorForRemainingRatio(remainingRatio) {
    // Default color transition: Blue→Green→Yellow→Orange→Red
    const defaultTable = [
        { ratio: 1.0, color: '#0088ff' },   // Blue: Yet to start
        { ratio: 0.75, color: '#00ff00' },  // Green: 0-25% done
        { ratio: 0.5, color: '#ffff00' },   // Yellow: 50% done
        { ratio: 0.25, color: '#ff8800' },  // Orange: 75% done
        { ratio: 0.0, color: '#ff0000' }    // Red: Zero
    ];

    // Use the color transition table from config
    const table = COLOR_TRANSITION_TABLE || defaultTable;

    // Sort table by ratio (descending)
    const sortedTable = [...table].sort((a, b) => b.ratio - a.ratio);

    // Clamp ratio to 0-1
    const ratio = Math.max(0, Math.min(1, remainingRatio));

    // Find the two entries that bracket our ratio
    for (let i = 0; i < sortedTable.length - 1; i++) {
        const entry1 = sortedTable[i];
        const entry2 = sortedTable[i + 1];

        if (ratio <= entry1.ratio && ratio >= entry2.ratio) {
            // Calculate interpolation factor (0 to 1)
            const range = entry1.ratio - entry2.ratio;
            const t = range === 0 ? 0 : (entry1.ratio - ratio) / range;

            // Interpolate between the two colors
            return lerpColor(entry1.color, entry2.color, t);
        }
    }

    // If ratio is outside all ranges, return the edge color
    if (ratio > sortedTable[0].ratio) {
        return sortedTable[0].color;
    }
    return sortedTable[sortedTable.length - 1].color;
}
