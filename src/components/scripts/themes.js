// ============ COLOR THEMES ============
// Per-timer themes: a preset color journey + page background.
// An explicit color_transition_table in the timer JSON always wins.
var THEMES = {
    toxic: {
        bg: '#1a1a2e',
        table: [
            { ratio: 1.0, color: '#0088ff' }, { ratio: 0.9, color: '#00aaff' },
            { ratio: 0.8, color: '#00ccff' }, { ratio: 0.75, color: '#00ff00' },
            { ratio: 0.6, color: '#80ff00' }, { ratio: 0.5, color: '#ffff00' },
            { ratio: 0.4, color: '#ffcc00' }, { ratio: 0.3, color: '#ffaa00' },
            { ratio: 0.25, color: '#ff8800' }, { ratio: 0.2, color: '#ff6600' },
            { ratio: 0.1, color: '#ff4400' }, { ratio: 0.0, color: '#ff0000' },
            { ratio: -0.25, color: '#ff0080' }, { ratio: -0.5, color: '#ee82ee' },
            { ratio: -0.75, color: '#c060ff' }, { ratio: -1.0, color: '#8b00ff' }
        ]
    },
    yandere: {
        bg: '#160409',
        table: [
            { ratio: 1.0, color: '#ffc2da' }, { ratio: 0.9, color: '#ff9ec2' },
            { ratio: 0.8, color: '#ff7dae' }, { ratio: 0.75, color: '#ff5c9c' },
            { ratio: 0.6, color: '#ff2d78' }, { ratio: 0.5, color: '#ff1f5e' },
            { ratio: 0.4, color: '#ff0f3f' }, { ratio: 0.3, color: '#e00b35' },
            { ratio: 0.25, color: '#c00730' }, { ratio: 0.2, color: '#a00528' },
            { ratio: 0.1, color: '#7d0420' }, { ratio: 0.0, color: '#5c0318' },
            { ratio: -0.25, color: '#b967ff' }, { ratio: -0.5, color: '#8b3fd9' },
            { ratio: -0.75, color: '#5f2b9e' }, { ratio: -1.0, color: '#3d1b66' }
        ]
    },
    amber: {
        bg: '#171006',
        table: [
            { ratio: 1.0, color: '#ffe9b0' }, { ratio: 0.9, color: '#ffdf8a' },
            { ratio: 0.8, color: '#ffd166' }, { ratio: 0.75, color: '#ffbf3f' },
            { ratio: 0.6, color: '#ffaa00' }, { ratio: 0.5, color: '#ff9500' },
            { ratio: 0.4, color: '#ff8300' }, { ratio: 0.3, color: '#ff7000' },
            { ratio: 0.25, color: '#fa5600' }, { ratio: 0.2, color: '#e04a00' },
            { ratio: 0.1, color: '#c23e00' }, { ratio: 0.0, color: '#a33200' },
            { ratio: -0.25, color: '#c060ff' }, { ratio: -0.5, color: '#8b3fd9' },
            { ratio: -0.75, color: '#5f2b9e' }, { ratio: -1.0, color: '#3d1b66' }
        ]
    },
    ice: {
        bg: '#04141a',
        table: [
            { ratio: 1.0, color: '#e8fbff' }, { ratio: 0.9, color: '#c8f4ff' },
            { ratio: 0.8, color: '#a5ecff' }, { ratio: 0.75, color: '#7fe3ff' },
            { ratio: 0.6, color: '#4fd8ff' }, { ratio: 0.5, color: '#22ccff' },
            { ratio: 0.4, color: '#00b8f0' }, { ratio: 0.3, color: '#009ed6' },
            { ratio: 0.25, color: '#0088bb' }, { ratio: 0.2, color: '#00709c' },
            { ratio: 0.1, color: '#005a7d' }, { ratio: 0.0, color: '#00465f' },
            { ratio: -0.25, color: '#4f7fff' }, { ratio: -0.5, color: '#6a5cff' },
            { ratio: -0.75, color: '#4a3fae' }, { ratio: -1.0, color: '#2e2768' }
        ]
    },
    blood: {
        bg: '#170505',
        table: [
            { ratio: 1.0, color: '#ffb3ab' }, { ratio: 0.9, color: '#ff8d84' },
            { ratio: 0.8, color: '#ff6a5e' }, { ratio: 0.75, color: '#ff4a3d' },
            { ratio: 0.6, color: '#f03226' }, { ratio: 0.5, color: '#d42a20' },
            { ratio: 0.4, color: '#b4241b' }, { ratio: 0.3, color: '#931e16' },
            { ratio: 0.25, color: '#7d1a13' }, { ratio: 0.2, color: '#671510' },
            { ratio: 0.1, color: '#52110d' }, { ratio: 0.0, color: '#3d0d0a' },
            { ratio: -0.25, color: '#8b1e3f' }, { ratio: -0.5, color: '#5c1530' },
            { ratio: -0.75, color: '#3d0f22' }, { ratio: -1.0, color: '#260914' }
        ]
    },
    violet: {
        bg: '#100722',
        table: [
            { ratio: 1.0, color: '#e3ccff' }, { ratio: 0.9, color: '#d3a6ff' },
            { ratio: 0.8, color: '#c084fc' }, { ratio: 0.75, color: '#a855f7' },
            { ratio: 0.6, color: '#9333ea' }, { ratio: 0.5, color: '#7e22ce' },
            { ratio: 0.4, color: '#6b21a8' }, { ratio: 0.3, color: '#581c87' },
            { ratio: 0.25, color: '#4a1872' }, { ratio: 0.2, color: '#3b1260' },
            { ratio: 0.1, color: '#2e0e4e' }, { ratio: 0.0, color: '#230a3c' },
            { ratio: -0.25, color: '#ff2d78' }, { ratio: -0.5, color: '#ff0f3f' },
            { ratio: -0.75, color: '#a31236' }, { ratio: -1.0, color: '#5c0a20' }
        ]
    },
    midnight: {
        bg: '#05070c',
        table: [
            { ratio: 1.0, color: '#8fa3bf' }, { ratio: 0.9, color: '#7d94b5' },
            { ratio: 0.8, color: '#6b84a8' }, { ratio: 0.75, color: '#5a759b' },
            { ratio: 0.6, color: '#4d688e' }, { ratio: 0.5, color: '#425a7d' },
            { ratio: 0.4, color: '#384e6c' }, { ratio: 0.3, color: '#2e415b' },
            { ratio: 0.25, color: '#28394f' }, { ratio: 0.2, color: '#223144' },
            { ratio: 0.1, color: '#1c2939' }, { ratio: 0.0, color: '#16212e' },
            { ratio: -0.25, color: '#3a4a6b' }, { ratio: -0.5, color: '#2c3a58' },
            { ratio: -0.75, color: '#1f2a42' }, { ratio: -1.0, color: '#141c2e' }
        ]
    }
};

// True when the timer JSON carries its own color table (it always wins).
// config.js declares this first; only default it when loading standalone
// (e.g. the up-next page, which has no config.js).
if (typeof __CUSTOM_COLORS === 'undefined') { var __CUSTOM_COLORS = false; }

/**
 * Apply a theme: page background + countdown color journey.
 * @param {string} name Theme key
 */
function applyTheme(name) {
    var key = (name && THEMES[name]) ? name : 'toxic';
    if (document && document.body) document.body.dataset.theme = key;
    if (__CUSTOM_COLORS) return;
    COLOR_TRANSITION_TABLE = THEMES[key].table.map(function (e) {
        return { ratio: e.ratio, color: e.color };
    });
    if (typeof calculateRemainingRatio === 'function' && typeof getColorForRemainingRatio === 'function') {
        var r = calculateRemainingRatio();
        var c = getColorForRemainingRatio(r);
        targetColor = c;
        currentColor = c;
        colorTransitionProgress = 1;
        if (typeof applyColor === 'function') applyColor(c);
    }
}
