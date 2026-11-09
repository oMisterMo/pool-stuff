const WIDTH = 800;
const HEIGHT = 600;

const LINE_COLOR = '#FFFFFF1A';
const BAULK_LINE_COLOR = '#FFFFFF66';
const POCKET_COLOR = '#0A0A0A';

const NO_OF_COLUMNS = 8;
const NO_OF_ROWS = 4;
const BAULK_COLUMN = 2;

const BALL_RADIUS = 8;
const MAX_BALLS = 50;
const BALL_COLORS = {
    white: '#F5F5F5',
    red: '#C8102E',
    yellow: '#FFD100',
    black: '#111111'
};
// Only one of each of these can be on the table.
const SINGLE_BALL_COLORS = ['white', 'black'];
const BALL_EDGE_COLOR = '#00000080';
const BLACK_BALL_EDGE_COLOR = '#D3D3D366';
const GHOST_BALL_ALPHA = 0.5;

const ARROW_COLOR = 'black';
const ARROW_OUTLINE_COLOR = '#00000080';
const ARROW_WIDTH = 1;
const ARROW_HEAD_LENGTH = 7;
const ARROW_HEAD_WIDTH = 8;
// Shorter drags are treated as a mis-tap and dropped.
const MIN_ARROW_LENGTH = BALL_RADIUS * 2;
// Extra reach around a ball when starting an arrow, so it's easy to hit by touch.
const ARROW_GRAB_MARGIN = 6;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const snapCheckbox = document.getElementById('snap');
const arrowModeCheckbox = document.getElementById('arrow-mode');

function resizeCanvas() {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
}

// x, y, width and height describe the playing surface (2:1, measured
// between the cushion noses), so ball physics can use them directly.
const poolTable = {
    width: 640,
    height: 320,
    railWidth: 40,
    cushionWidth: 16,
    cornerPocketRadius: 18,
    sidePocketRadius: 17,
    // Distance from a pocket's centre line to where the cushion nose starts
    cornerJaw: 20.5,
    sideJaw: 18,
    // How much narrower the side pocket gets from nose to back of cushion
    sideJawTaper: 5
};
poolTable.x = (WIDTH - poolTable.width) / 2;
poolTable.y = (HEIGHT - poolTable.height) / 2;

const THEMES = [
    {
        name: 'Classic Green',
        clothColor: '#006400',
        cushionColor: '#003D00',
        cushionEdgeColor: '#2E8B2E',
        railColor: '#5C3317',
        railEdgeColor: '#3A1F0D',
        diamondColor: '#F3E9D2'
    },
    {
        name: 'Tournament Blue',
        clothColor: '#1F5FA8',
        cushionColor: '#143F70',
        cushionEdgeColor: '#4A86CC',
        railColor: '#2B2B2B',
        railEdgeColor: '#111111',
        diamondColor: '#E0E0E0'
    },
    {
        name: 'Burgundy',
        clothColor: '#7A1E2C',
        cushionColor: '#4F121C',
        cushionEdgeColor: '#A3384A',
        railColor: '#3B2414',
        railEdgeColor: '#24150B',
        diamondColor: '#E8D9A8'
    },
    {
        name: 'Slate Grey',
        clothColor: '#4A5560',
        cushionColor: '#323A42',
        cushionEdgeColor: '#6E7B88',
        railColor: '#1C1C1C',
        railEdgeColor: '#000000',
        diamondColor: '#C0C0C0'
    },
    {
        name: 'Maple Teal',
        clothColor: '#00757A',
        cushionColor: '#004E52',
        cushionEdgeColor: '#2FA3A8',
        railColor: '#C89B5E',
        railEdgeColor: '#8E6A3A',
        diamondColor: '#4A2E14'
    }
];

const THEME_STORAGE_KEY = 'poolTableTheme';

// Storage can be unavailable (e.g. blocked for file:// pages), so fall back quietly.
function loadTheme() {
    try {
        const name = localStorage.getItem(THEME_STORAGE_KEY);
        return THEMES.find(theme => theme.name === name) ?? THEMES[0];
    } catch {
        return THEMES[0];
    }
}

function saveTheme() {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme.name);
    } catch {}
}

let theme = loadTheme();
let balls = [];
let selectedColor = 'white';
let cursor = null;
// Each arrow is { ball, x, y, target }: it starts at `ball` and points to (x, y).
// `target` is the ball the tip snapped to, if any.
let arrows = [];
// The arrow being dragged out in arrow mode, if any.
let draftArrow = null;

function drawRails() {
    const { x, y, width, height, railWidth, cushionWidth } = poolTable;
    const border = railWidth + cushionWidth;

    ctx.fillStyle = theme.railColor;
    ctx.strokeStyle = theme.railEdgeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x - border, y - border, width + border * 2, height + border * 2, 16);
    ctx.fill();
    ctx.stroke();
}

function drawCloth() {
    const { x, y, width, height, cushionWidth } = poolTable;

    ctx.fillStyle = theme.clothColor;
    ctx.fillRect(x - cushionWidth, y - cushionWidth, width + cushionWidth * 2, height + cushionWidth * 2);
}

function drawGridLines() {
    const { x, y, width, height } = poolTable;

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 2;

    for (let i = 1; i < NO_OF_COLUMNS; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (i * width) / NO_OF_COLUMNS, y);
        ctx.lineTo(x + (i * width) / NO_OF_COLUMNS, y + height);
        ctx.stroke();
    }
    for (let i = 1; i < NO_OF_ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + (i * height) / NO_OF_ROWS);
        ctx.lineTo(x + width, y + (i * height) / NO_OF_ROWS);
        ctx.stroke();
    }

    // Make the baulk line thicker
    ctx.strokeStyle = BAULK_LINE_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + (BAULK_COLUMN * width) / NO_OF_COLUMNS, y);
    ctx.lineTo(x + (BAULK_COLUMN * width) / NO_OF_COLUMNS, y + height);
    ctx.stroke();
}

function drawPockets() {
    const { x, y, width, height, cushionWidth, cornerPocketRadius, sidePocketRadius, cornerJaw, sideJaw, sideJawTaper } = poolTable;
    const cornerBack = cornerJaw - cushionWidth;
    const sideBack = sideJaw - sideJawTaper;
    const cornerInset = 8;
    const sideInset = cushionWidth + 2;

    const pockets = [
        { x: x - cornerInset, y: y - cornerInset, radius: cornerPocketRadius }, // Top-left
        { x: x + width / 2, y: y - sideInset, radius: sidePocketRadius }, // Top-center
        { x: x + width + cornerInset, y: y - cornerInset, radius: cornerPocketRadius }, // Top-right
        { x: x - cornerInset, y: y + height + cornerInset, radius: cornerPocketRadius }, // Bottom-left
        { x: x + width / 2, y: y + height + sideInset, radius: sidePocketRadius }, // Bottom-center
        { x: x + width + cornerInset, y: y + height + cornerInset, radius: cornerPocketRadius } // Bottom-right
    ];

    ctx.fillStyle = POCKET_COLOR;
    pockets.forEach(pocket => {
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Fill the throats between the cushion jaws so each pocket opens at the nose
    // [[x, y, 1, 1], [x + width, y, -1, 1], [x, y + height, 1, -1], [x + width, y + height, -1, -1]].forEach(([cornerX, cornerY, dirX, dirY]) => {
    //     ctx.beginPath();
    //     ctx.moveTo(cornerX + dirX * cornerJaw, cornerY);
    //     ctx.lineTo(cornerX + dirX * cornerBack, cornerY - dirY * cushionWidth);
    //     ctx.lineTo(cornerX - dirX * cushionWidth, cornerY + dirY * cornerBack);
    //     ctx.lineTo(cornerX, cornerY + dirY * cornerJaw);
    //     ctx.closePath();
    //     ctx.fill();
    // });
    // [[y, -1], [y + height, 1]].forEach(([railY, direction]) => {
    //     const middle = x + width / 2;
    //     ctx.beginPath();
    //     ctx.moveTo(middle - sideJaw, railY);
    //     ctx.lineTo(middle - sideBack, railY + direction * cushionWidth);
    //     ctx.lineTo(middle + sideBack, railY + direction * cushionWidth);
    //     ctx.lineTo(middle + sideJaw, railY);
    //     ctx.closePath();
    //     ctx.fill();
    // });
}

// Draws one cushion as a trapezoid. `start` and `end` are the nose points on
// the edge of the playing surface, `back` is the unit vector pointing to the rail.
// Each cushion end is pulled in along the rail by its jaw offset at the back.
function drawCushion(start, end, back, startOffset, endOffset) {
    const depth = poolTable.cushionWidth;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const along = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };

    ctx.fillStyle = theme.cushionColor;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(start.x + back.x * depth + along.x * startOffset, start.y + back.y * depth + along.y * startOffset);
    ctx.lineTo(end.x + back.x * depth - along.x * endOffset, end.y + back.y * depth - along.y * endOffset);
    ctx.lineTo(end.x, end.y);
    ctx.closePath();
    ctx.fill();

    // Highlight the nose, the edge the balls actually hit
    ctx.strokeStyle = theme.cushionEdgeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
}

function drawCushions() {
    const { x, y, width, height, cushionWidth, cornerJaw, sideJaw, sideJawTaper } = poolTable;
    const left = x;
    const right = x + width;
    const top = y;
    const bottom = y + height;
    const middle = x + width / 2;

    // Corner jaws run parallel to the pocket's diagonal, so they move
    // towards the corner by one cushion depth. Negative offsets extend the back edge.
    const cornerOffset = -cushionWidth;
    const sideOffset = -sideJawTaper;

    // Long side cushions, either side of the side pockets
    [[top, -1], [bottom, 1]].forEach(([railY, direction]) => {
        const back = { x: 0, y: direction };
        drawCushion({ x: left + cornerJaw, y: railY }, { x: middle - sideJaw, y: railY }, back, cornerOffset, sideOffset);
        drawCushion({ x: middle + sideJaw, y: railY }, { x: right - cornerJaw, y: railY }, back, sideOffset, cornerOffset);
    });

    // Short cushions at each end of the table
    [[left, -1], [right, 1]].forEach(([railX, direction]) => {
        const back = { x: direction, y: 0 };
        drawCushion({ x: railX, y: top + cornerJaw }, { x: railX, y: bottom - cornerJaw }, back, cornerOffset, cornerOffset);
    });
}

function drawDiamond(centerX, centerY) {
    const size = 5;

    ctx.fillStyle = theme.diamondColor;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size);
    ctx.lineTo(centerX + size, centerY);
    ctx.lineTo(centerX, centerY + size);
    ctx.lineTo(centerX - size, centerY);
    ctx.closePath();
    ctx.fill();
}

// Diamonds sit in the middle of the rail, lined up with the grid lines.
// The ones level with the side pockets are skipped on the long rails.
function drawDiamonds() {
    const { x, y, width, height, railWidth, cushionWidth } = poolTable;
    const railCenter = cushionWidth + railWidth / 2;

    for (let i = 1; i < NO_OF_COLUMNS; i++) {
        if (i === NO_OF_COLUMNS / 2) continue;
        const diamondX = x + (i * width) / NO_OF_COLUMNS;
        drawDiamond(diamondX, y - railCenter);
        drawDiamond(diamondX, y + height + railCenter);
    }
    for (let i = 1; i < NO_OF_ROWS; i++) {
        const diamondY = y + (i * height) / NO_OF_ROWS;
        drawDiamond(x - railCenter, diamondY);
        drawDiamond(x + width + railCenter, diamondY);
    }
}

function ballEdgeColor(color) {
    return color === 'black' ? BLACK_BALL_EDGE_COLOR : BALL_EDGE_COLOR;
}

function drawBall(ball) {
    ctx.fillStyle = BALL_COLORS[ball.color];
    ctx.strokeStyle = ballEdgeColor(ball.color);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

function drawBalls() {
    balls.forEach(drawBall);
}

// Draws an arrow from the edge of its ball to its tip.
function drawArrow(arrow) {
    const { ball, x: tipX, y: tipY } = arrow;
    const length = Math.hypot(tipX - ball.x, tipY - ball.y);
    if (length <= BALL_RADIUS) return;

    const dirX = (tipX - ball.x) / length;
    const dirY = (tipY - ball.y) / length;
    const startX = ball.x + dirX * BALL_RADIUS;
    const startY = ball.y + dirY * BALL_RADIUS;
    // The shaft stops where the head begins, so the tip stays sharp.
    const headLength = Math.min(ARROW_HEAD_LENGTH, length - BALL_RADIUS);
    const baseX = tipX - dirX * headLength;
    const baseY = tipY - dirY * headLength;
    const halfWidth = ARROW_HEAD_WIDTH / 2;

    const shaft = new Path2D();
    shaft.moveTo(startX, startY);
    shaft.lineTo(baseX, baseY);

    const head = new Path2D();
    head.moveTo(tipX, tipY);
    head.lineTo(baseX - dirY * halfWidth, baseY + dirX * halfWidth);
    head.lineTo(baseX + dirY * halfWidth, baseY - dirX * halfWidth);
    head.closePath();

    // A dark outline keeps the arrow visible on light cloth and over balls.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ARROW_OUTLINE_COLOR;
    ctx.lineWidth = ARROW_WIDTH;
    ctx.stroke(shaft);
    ctx.stroke(head);

    ctx.strokeStyle = ARROW_COLOR;
    ctx.fillStyle = ARROW_COLOR;
    ctx.lineWidth = ARROW_WIDTH;
    ctx.stroke(shaft);
    ctx.fill(head);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
}

function drawArrows() {
    arrows.forEach(drawArrow);
    if (draftArrow) drawArrow(draftArrow);
}

// Previews where a click would place the selected ball.
function drawGhostBall() {
    if (!cursor || arrowModeCheckbox.checked) return;

    const ghost = findPlacement(cursor.x, cursor.y, selectedColor);
    if (!ghost) return;

    ctx.globalAlpha = GHOST_BALL_ALPHA;
    drawBall(ghost);
    ctx.globalAlpha = 1;
}

function drawPool() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawRails();
    drawCloth();
    drawGridLines();
    drawCushions();
    drawDiamonds();
    drawPockets();
    drawBalls();
    drawArrows();
    drawGhostBall();
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Keeps the whole ball on the playing surface, not just its centre.
function clampToSurface(x, y) {
    return {
        x: clamp(x, poolTable.x + BALL_RADIUS, poolTable.x + poolTable.width - BALL_RADIUS),
        y: clamp(y, poolTable.y + BALL_RADIUS, poolTable.y + poolTable.height - BALL_RADIUS)
    };
}

function overlapsBall(spot, others) {
    return others.some(ball => Math.hypot(ball.x - spot.x, ball.y - spot.y) < BALL_RADIUS * 2);
}

// Searches outward in rings for the nearest spot on the surface that doesn't
// overlap a ball, about 1px apart. Returns null if the table is full.
function findFreeSpot(x, y, others) {
    const maxDistance = Math.hypot(poolTable.width, poolTable.height);

    for (let distance = 0; distance <= maxDistance; distance++) {
        const steps = Math.max(1, Math.ceil(Math.PI * 2 * distance));
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const spot = clampToSurface(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
            if (!overlapsBall(spot, others)) return spot;
        }
    }
    return null;
}

// Finds the nearest free snap point. These are spaced half a quad apart, so
// they cover the grid lines, the quad centres and the table edges, where the
// ball rests against the cushion. Returns null if every snap point is taken.
function findFreeSnapSpot(x, y, others) {
    const columns = NO_OF_COLUMNS * 2;
    const rows = NO_OF_ROWS * 2;
    let nearest = null;
    let nearestDistance = Infinity;

    for (let i = 0; i <= columns; i++) {
        for (let j = 0; j <= rows; j++) {
            const spot = clampToSurface(
                poolTable.x + (i * poolTable.width) / columns,
                poolTable.y + (j * poolTable.height) / rows
            );
            const distance = Math.hypot(spot.x - x, spot.y - y);
            if (distance < nearestDistance && !overlapsBall(spot, others)) {
                nearest = spot;
                nearestDistance = distance;
            }
        }
    }
    return nearest;
}

// A new white or black ball replaces the old one.
function ballsKeptWhenPlacing(color) {
    return SINGLE_BALL_COLORS.includes(color) ? balls.filter(ball => ball.color !== color) : balls;
}

// Returns the ball a click would place, or null if there is no room for it.
function findPlacement(x, y, color) {
    const others = ballsKeptWhenPlacing(color);
    if (others.length >= MAX_BALLS) return null;

    const spot = snapCheckbox.checked ? findFreeSnapSpot(x, y, others) : findFreeSpot(x, y, others);
    return spot && { ...spot, color };
}

function placeBall(x, y, color) {
    const ball = findPlacement(x, y, color);
    if (!ball) return;

    balls = [...ballsKeptWhenPlacing(color), ball];
    removeOrphanedArrows();
    drawPool();
}

// The canvas is scaled by CSS on small screens, so pointer positions are
// converted from displayed pixels to drawing pixels.
function toCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (WIDTH / rect.width),
        y: (event.clientY - rect.top) * (HEIGHT / rect.height)
    };
}

// Arrows belong to a ball, so they go when it's cleared or replaced.
function removeOrphanedArrows() {
    arrows = arrows.filter(arrow => balls.includes(arrow.ball) && (!arrow.target || balls.includes(arrow.target)));
}

// Returns the ball nearest the point, if the point is on or just around it.
// `exclude` is skipped, e.g. the ball an arrow starts from.
function findBallAt(x, y, exclude = null) {
    let nearest = null;
    let nearestDistance = BALL_RADIUS + ARROW_GRAB_MARGIN;

    balls.forEach(ball => {
        if (ball === exclude) return;
        const distance = Math.hypot(ball.x - x, ball.y - y);
        if (distance <= nearestDistance) {
            nearest = ball;
            nearestDistance = distance;
        }
    });
    return nearest;
}

canvas.addEventListener('pointerdown', event => {
    if (!arrowModeCheckbox.checked || !event.isPrimary) return;

    const point = toCanvasPoint(event);
    const ball = findBallAt(point.x, point.y);
    if (!ball) return;

    canvas.setPointerCapture(event.pointerId);
    draftArrow = { ball, ...point, target: null };
    drawPool();
});

// Works out where an arrow from `ball` dragged to `point` ends. Over another
// ball, the tip snaps to that ball's near edge, aimed at its centre.
function arrowTip(ball, point) {
    const target = findBallAt(point.x, point.y, ball);
    if (!target) {
        // Keeps the tip on the canvas, so the head is never cut off.
        return { x: clamp(point.x, 0, WIDTH), y: clamp(point.y, 0, HEIGHT), target: null };
    }

    const distance = Math.hypot(target.x - ball.x, target.y - ball.y);
    return {
        x: target.x - ((target.x - ball.x) / distance) * BALL_RADIUS,
        y: target.y - ((target.y - ball.y) / distance) * BALL_RADIUS,
        target
    };
}

function finishArrow(event, keep) {
    if (!draftArrow || !event.isPrimary) return;

    const { ball, x, y } = draftArrow;
    if (keep && Math.hypot(x - ball.x, y - ball.y) >= MIN_ARROW_LENGTH) {
        arrows = [...arrows, draftArrow];
    }
    draftArrow = null;
    drawPool();
}

canvas.addEventListener('pointerup', event => finishArrow(event, true));
canvas.addEventListener('pointercancel', event => finishArrow(event, false));

canvas.addEventListener('click', event => {
    if (arrowModeCheckbox.checked) return;

    const point = toCanvasPoint(event);
    placeBall(point.x, point.y, selectedColor);
    cursor = null;
    drawPool();
});

// Touch has no hover, so the ghost ball only follows a mouse or pen.
canvas.addEventListener('pointermove', event => {
    if (draftArrow && event.isPrimary) {
        const point = toCanvasPoint(event);
        draftArrow = { ball: draftArrow.ball, ...arrowTip(draftArrow.ball, point) };
        drawPool();
        return;
    }
    if (event.pointerType === 'touch') return;
    cursor = toCanvasPoint(event);
    drawPool();
});

canvas.addEventListener('pointerleave', () => {
    cursor = null;
    drawPool();
});

snapCheckbox.addEventListener('change', drawPool);

arrowModeCheckbox.addEventListener('change', () => {
    canvas.classList.toggle('arrow-mode', arrowModeCheckbox.checked);
    draftArrow = null;
    drawPool();
});

const ballPickers = document.querySelectorAll('.ball-picker');
ballPickers.forEach(picker => {
    picker.style.backgroundColor = BALL_COLORS[picker.dataset.color];
    picker.style.borderColor = ballEdgeColor(picker.dataset.color);
    picker.addEventListener('click', () => {
        selectedColor = picker.dataset.color;
        ballPickers.forEach(other => other.classList.toggle('selected', other === picker));
    });
});

// Clears the balls of one colour, or all of them if no colour is given.
function clearBalls(color) {
    balls = color ? balls.filter(ball => ball.color !== color) : [];
    removeOrphanedArrows();
    drawPool();
}

document.querySelectorAll('.clear-balls').forEach(button => {
    button.addEventListener('click', () => clearBalls(button.dataset.color));
});

document.getElementById('clear-arrows').addEventListener('click', () => {
    arrows = [];
    drawPool();
});

const themeButton = document.getElementById('theme');

function showThemeName() {
    themeButton.textContent = `Theme: ${theme.name}`;
}

function nextTheme() {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    saveTheme();
    showThemeName();
    drawPool();
}

themeButton.addEventListener('click', nextTheme);
showThemeName();

function exportPng() {
    // Keeps the ghost ball out of the image.
    cursor = null;
    drawPool();

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'pool-table.png';
    link.click();
}

document.getElementById('export').addEventListener('click', exportPng);

resizeCanvas();
drawPool();
