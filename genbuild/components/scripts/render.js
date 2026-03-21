function getColor() {
    return currentColor;
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

    const color = getColor();
    applyColor(color);
}
