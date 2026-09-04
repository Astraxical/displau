function getColor() {
    return currentColor;
}

/**
 * Get color for negative time display
 * Uses the same color system as the transition table
 */
function getNegativeTimeColor() {
    // For negative time, calculate color based on how far into negative
    // This will be handled by getColorForRemainingRatio with negative ratio
    // Return a default violet as fallback
    return '#ee82ee';
}

function getDarkerComplementaryColor(hex) {
    const rgb = hexToRgb(hex);
    const factor = 0.3;
    return rgbToHex(
        (255 - rgb.r) * factor,
        (255 - rgb.g) * factor,
        (255 - rgb.b) * factor
    );
}

function applyColor(color) {
    const complementary = getDarkerComplementaryColor(color);

    document.querySelectorAll('.segment-part.on').forEach(seg => {
        seg.style.background = color;
        seg.style.boxShadow = `0 0 0.2em ${color}, 0 0 0.4em ${color}`;
    });

    document.querySelectorAll('.segment-part:not(.on)').forEach(seg => {
        seg.style.background = complementary;
        seg.style.boxShadow = '';
    });

    document.querySelectorAll('.colon-dot.on').forEach(dot => {
        dot.style.background = color;
        dot.style.boxShadow = `0 0 0.2em ${color}, 0 0 0.4em ${color}`;
    });

    document.querySelectorAll('.colon-dot:not(.on)').forEach(dot => {
        dot.style.background = complementary;
    });
}

/**
 * Apply color for negative time display
 * Uses the current color from the transition table (which handles negative ratios)
 */
function applyNegativeTimeColor() {
    // Use the currentColor which is already calculated from the transition table
    // for negative time ratios
    const color = currentColor || '#ee82ee';
    const complementary = getDarkerComplementaryColor(color);

    document.querySelectorAll('.segment-part.on').forEach(seg => {
        seg.style.background = color;
        seg.style.boxShadow = `0 0 0.2em ${color}, 0 0 0.4em ${color}`;
    });

    document.querySelectorAll('.segment-part:not(.on)').forEach(seg => {
        seg.style.background = complementary;
        seg.style.boxShadow = '';
    });

    document.querySelectorAll('.colon-dot.on').forEach(dot => {
        dot.style.background = color;
        dot.style.boxShadow = `0 0 0.2em ${color}, 0 0 0.4em ${color}`;
    });

    document.querySelectorAll('.colon-dot:not(.on)').forEach(dot => {
        dot.style.background = complementary;
    });

    // Color the minus sign
    const minusBar = document.querySelector('.minus-bar');
    if (minusBar) {
        minusBar.style.background = color;
        minusBar.style.boxShadow = `0 0 0.12em ${color}, 0 0 0.25em ${color}`;
    }
}

function setDigit(element, value) {
    const segments = element.querySelectorAll('.segment-part');
    const num = parseInt(value);
    const color = getColor();
    const complementary = getDarkerComplementaryColor(color);

    if (!isNaN(num) && patterns[num]) {
        patterns[num].forEach((on, i) => {
            if (on) {
                segments[i].classList.add('on');
                segments[i].style.background = color;
                segments[i].style.boxShadow = `0 0 0.2em ${color}, 0 0 0.4em ${color}`;
            } else {
                segments[i].classList.remove('on');
                segments[i].style.background = complementary;
                segments[i].style.boxShadow = '';
            }
        });
    }
}

// Shape cache: the display rebuilds its DOM only when the token shape
// changes. Otherwise digits update in place — no per-frame reflow, which
// keeps the layout rock-solid under browser zoom.
let lastDisplayShape = null;

/**
 * Split a time string into render tokens.
 * @returns {Array<{t: string, v?: string}>} t: 'minus' | 'digit' | 'colon' | 'decimal'
 */
function tokenizeTime(timeStr) {
    let s = timeStr;
    const tokens = [];
    if (s.startsWith('-')) {
        tokens.push({ t: 'minus' });
        s = s.substring(1); // Remove the minus sign for parsing
    }
    const colonCount = (s.match(/:/g) || []).length;
    const pushDigits = (str) => {
        for (const ch of str) tokens.push({ t: 'digit', v: ch });
    };

    if (colonCount === 3) {
        const parts = s.split(':');
        const days = parts[0];
        const hours = parts[1] || '00';
        const minutes = parts[2] || '00';
        const seconds = parts[3] || '00';

        pushDigits(days);
        tokens.push({ t: 'colon' });
        pushDigits(hours);
        tokens.push({ t: 'colon' });
        pushDigits(minutes);
        tokens.push({ t: 'colon' });
        pushDigits(seconds);
    } else if (colonCount === 2) {
        const parts = s.split(':');
        const hours = parts[0];
        const minutes = parts[1] || '00';
        const secondsParts = (parts[2] || '00').split('.');
        const seconds = secondsParts[0] || '00';
        const decimals = secondsParts[1] || '';

        pushDigits(hours);
        tokens.push({ t: 'colon' });
        pushDigits(minutes);
        tokens.push({ t: 'colon' });
        pushDigits(seconds);

        if (decimals.length > 0) {
            tokens.push({ t: 'decimal' });
            pushDigits(decimals);
        }
    } else {
        const parts = s.split(':');
        const minutes = parts[0];
        const secondsParts = (parts[1] || '00').split('.');
        const seconds = secondsParts[0] || '00';
        const decimals = secondsParts[1] || '';

        pushDigits(minutes);
        tokens.push({ t: 'colon' });
        pushDigits(seconds);
        tokens.push({ t: 'decimal' });
        pushDigits(decimals);
    }
    return tokens;
}

function buildTokenEl(tok) {
    if (tok.t === 'digit') {
        const el = createDigit();
        setDigit(el, tok.v);
        return el;
    }
    if (tok.t === 'colon') return createColon();
    if (tok.t === 'decimal') return createDecimal();
    return createMinusSign();
}

function updateDisplay(timeStr) {
    const display = document.getElementById('display');
    const isNegative = timeStr.startsWith('-');
    const tokens = tokenizeTime(timeStr);
    const shape = (isNegative ? '-' : '+') + tokens.map(t => t.t === 'digit' ? `d${t.v.length}` : t.t[0]).join('');

    if (shape === lastDisplayShape && display.children.length === tokens.length) {
        // Same shape: update digit values in place, zero layout shift.
        const digitEls = display.querySelectorAll('.segment');
        let di = 0;
        for (const tok of tokens) {
            if (tok.t === 'digit') setDigit(digitEls[di++], tok.v);
        }
    } else {
        display.innerHTML = '';
        for (const tok of tokens) display.appendChild(buildTokenEl(tok));
        lastDisplayShape = shape;
        fitDisplay();
    }

    // Apply color based on whether this is negative time
    if (isNegative) {
        applyNegativeTimeColor();
    } else {
        const color = getColor();
        applyColor(color);
    }
}

/**
 * Scale the display down (transform only — no reflow) when the digit
 * string is wider than the viewport, e.g. multi-day counts on mobile.
 */
function fitDisplay() {
    const display = document.getElementById('display');
    if (!display) return;
    display.style.transform = '';
    const over = display.scrollWidth - document.documentElement.clientWidth;
    if (over > 0 && display.scrollWidth > 0) {
        const scale = Math.min(1, document.documentElement.clientWidth * 0.96 / display.scrollWidth);
        display.style.transform = `scale(${scale})`;
    }
}

window.addEventListener('resize', () => {
    lastDisplayShape = null; // force re-measure on viewport change
});

/**
 * Create a minus sign element for negative time display
 * @returns {HTMLDivElement} Minus sign element
 */
function createMinusSign() {
    const minus = document.createElement('div');
    minus.className = 'minus-sign';
    minus.innerHTML = '<div class="minus-bar"></div>';
    return minus;
}

/**
 * Show expired message overlay when timer ends (for on_expire: 'hide')
 */
function showExpiredMessage() {
    const display = document.getElementById('display');
    if (!display) return;
    
    // Clear the display
    display.innerHTML = '';
    display.style.transform = '';
    lastDisplayShape = '__expired__';
    
    // Create expired message container
    const expiredContainer = document.createElement('div');
    expiredContainer.className = 'expired-message';
    expiredContainer.innerHTML = `
        <div class="expired-text">EXPIRED</div>
        <div class="expired-subtext">${DISPLAY_NAME || 'Timer Complete'}</div>
    `;
    
    display.appendChild(expiredContainer);
    
    // Force red color for expired message
    const redColor = '#ff0000';
    document.body.style.setProperty('--expired-color', redColor);
}
