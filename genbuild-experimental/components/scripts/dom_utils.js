// Segment patterns for digits 0-9
const patterns = {
    0: [1, 1, 1, 1, 1, 1, 0],
    1: [0, 1, 1, 0, 0, 0, 0],
    2: [1, 1, 0, 1, 1, 0, 1],
    3: [1, 1, 1, 1, 0, 0, 1],
    4: [0, 1, 1, 0, 0, 1, 1],
    5: [1, 0, 1, 1, 0, 1, 1],
    6: [1, 0, 1, 1, 1, 1, 1],
    7: [1, 1, 1, 0, 0, 0, 0],
    8: [1, 1, 1, 1, 1, 1, 1],
    9: [1, 1, 1, 1, 0, 1, 1]
};

const segmentNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

function createDigit() {
    const digit = document.createElement('div');
    digit.className = 'segment';
    segmentNames.forEach(name => {
        const seg = document.createElement('div');
        seg.className = `segment-part seg-${name}`;
        digit.appendChild(seg);
    });
    return digit;
}

function createColon() {
    const colon = document.createElement('div');
    colon.className = 'colon';
    const dot1 = document.createElement('div');
    dot1.className = 'colon-dot on';
    const dot2 = document.createElement('div');
    dot2.className = 'colon-dot on';
    colon.appendChild(dot1);
    colon.appendChild(dot2);
    return colon;
}

function createDecimal() {
    const decimal = document.createElement('div');
    decimal.className = 'decimal';
    const dot = document.createElement('div');
    dot.className = 'colon-dot on';
    decimal.appendChild(dot);
    return decimal;
}
