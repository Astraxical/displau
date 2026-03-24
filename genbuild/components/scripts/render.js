// Negative time color (violet - beyond zero)
const NEGATIVE_TIME_COLOR = typeof window !== 'undefined' ? (window.NEGATIVE_TIME_COLOR || '#ee82ee') : '#ee82ee';

function getColor() {
    return currentColor;
}

/**
 * Get color for negative time display (violet - beyond zero)
 */
function getNegativeTimeColor() {
    return NEGATIVE_TIME_COLOR;
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

/**
 * Get darker complementary color for negative time
 */
function getNegativeTimeComplementary() {
    return getDarkerComplementaryColor(NEGATIVE_TIME_COLOR);
}

function applyColor(color) {
    const complementary = getDarkerComplementaryColor(color);

    document.querySelectorAll('.segment-part.on').forEach(seg => {
        seg.style.background = color;
        seg.style.boxShadow = `0 0 15px ${color}, 0 0 30px ${color}`;
    });

    document.querySelectorAll('.segment-part:not(.on)').forEach(seg => {
        seg.style.background = complementary;
        seg.style.boxShadow = '';
    });

    document.querySelectorAll('.colon-dot.on').forEach(dot => {
        dot.style.background = color;
        dot.style.boxShadow = `0 0 15px ${color}, 0 0 30px ${color}`;
    });

    document.querySelectorAll('.colon-dot:not(.on)').forEach(dot => {
        dot.style.background = complementary;
    });
}

/**
 * Apply dark pink color for negative time display
 */
function applyNegativeTimeColor() {
    const complementary = getNegativeTimeComplementary();

    document.querySelectorAll('.segment-part.on').forEach(seg => {
        seg.style.background = NEGATIVE_TIME_COLOR;
        seg.style.boxShadow = `0 0 15px ${NEGATIVE_TIME_COLOR}, 0 0 30px ${NEGATIVE_TIME_COLOR}`;
    });

    document.querySelectorAll('.segment-part:not(.on)').forEach(seg => {
        seg.style.background = complementary;
        seg.style.boxShadow = '';
    });

    document.querySelectorAll('.colon-dot.on').forEach(dot => {
        dot.style.background = NEGATIVE_TIME_COLOR;
        dot.style.boxShadow = `0 0 15px ${NEGATIVE_TIME_COLOR}, 0 0 30px ${NEGATIVE_TIME_COLOR}`;
    });

    document.querySelectorAll('.colon-dot:not(.on)').forEach(dot => {
        dot.style.background = complementary;
    });

    // Color the minus sign
    const minusBar = document.querySelector('.minus-bar');
    if (minusBar) {
        minusBar.style.background = NEGATIVE_TIME_COLOR;
        minusBar.style.boxShadow = `0 0 10px ${NEGATIVE_TIME_COLOR}, 0 0 20px ${NEGATIVE_TIME_COLOR}`;
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
                segments[i].style.boxShadow = `0 0 15px ${color}, 0 0 30px ${color}`;
            } else {
                segments[i].classList.remove('on');
                segments[i].style.background = complementary;
                segments[i].style.boxShadow = '';
            }
        });
    }
}

function updateDisplay(timeStr) {
    const display = document.getElementById('display');
    display.innerHTML = '';
    const colonCount = (timeStr.match(/:/g) || []).length;
    const isNegative = timeStr.startsWith('-');
    
    // Handle negative sign for negative time display
    if (isNegative) {
        const minusElement = createMinusSign();
        display.appendChild(minusElement);
        timeStr = timeStr.substring(1); // Remove the minus sign for parsing
    }

    if (colonCount === 3) {
        const parts = timeStr.split(':');
        const days = parts[0];
        const hours = parts[1] || '00';
        const minutes = parts[2] || '00';
        const seconds = parts[3] || '00';

        for (let i = 0; i < days.length; i++) {
            display.appendChild(createDigit());
            setDigit(display.lastChild, days[i]);
        }
        display.appendChild(createColon());
        display.appendChild(createDigit());
        setDigit(display.lastChild, hours[0]);
        display.appendChild(createDigit());
        setDigit(display.lastChild, hours[1]);
        display.appendChild(createColon());
        display.appendChild(createDigit());
        setDigit(display.lastChild, minutes[0]);
        display.appendChild(createDigit());
        setDigit(display.lastChild, minutes[1]);
        display.appendChild(createColon());
        display.appendChild(createDigit());
        setDigit(display.lastChild, seconds[0]);
        display.appendChild(createDigit());
        setDigit(display.lastChild, seconds[1]);
    } else if (colonCount === 2) {
        const parts = timeStr.split(':');
        const hours = parts[0];
        const minutes = parts[1] || '00';
        const secondsParts = (parts[2] || '00').split('.');
        const seconds = secondsParts[0] || '00';
        const decimals = secondsParts[1] || '';

        for (let i = 0; i < hours.length; i++) {
            display.appendChild(createDigit());
            setDigit(display.lastChild, hours[i]);
        }
        display.appendChild(createColon());
        display.appendChild(createDigit());
        setDigit(display.lastChild, minutes[0]);
        display.appendChild(createDigit());
        setDigit(display.lastChild, minutes[1]);
        display.appendChild(createColon());
        display.appendChild(createDigit());
        setDigit(display.lastChild, seconds[0]);
        display.appendChild(createDigit());
        setDigit(display.lastChild, seconds[1]);

        if (decimals.length > 0) {
            display.appendChild(createDecimal());
            for (let i = 0; i < decimals.length; i++) {
                display.appendChild(createDigit());
                setDigit(display.lastChild, decimals[i]);
            }
        }
    } else {
        const parts = timeStr.split(':');
        const minutes = parts[0];
        const secondsParts = (parts[1] || '00').split('.');
        const seconds = secondsParts[0] || '00';
        const decimals = secondsParts[1] || '';

        for (let i = 0; i < minutes.length; i++) {
            display.appendChild(createDigit());
            setDigit(display.lastChild, minutes[i]);
        }
        display.appendChild(createColon());
        display.appendChild(createDigit());
        setDigit(display.lastChild, seconds[0]);
        display.appendChild(createDigit());
        setDigit(display.lastChild, seconds[1]);
        display.appendChild(createDecimal());
        for (let i = 0; i < decimals.length; i++) {
            display.appendChild(createDigit());
            setDigit(display.lastChild, decimals[i]);
        }
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
