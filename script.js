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
// Holding Shift snaps arrows to multiples of this angle (horizontal, vertical, diagonal).
const ARROW_ANGLE_STEP = Math.PI / 4;
// Arrows from this ball to another get a ghost ball showing where it makes contact.
const CUE_BALL_COLOR = 'white';

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
// Each arrow is { ball, x, y, target, ghost }: it starts at `ball` and points to (x, y).
// `target` is the ball the tip snapped to, if any. For a cue ball arrow with a
// target, `ghost` is the centre of the cue ball at contact, and (x, y) is on its edge.
let arrows = [];
// The cue ball arrow whose ghost ball is being dragged, if any, and the last
// pointer position, so the ghost can be moved again when Shift changes.
let ghostDragArrow = null;
let ghostDragPointer = null;
// The arrow being dragged out in arrow mode, if any. It also keeps the raw
// `pointer` position, so the tip can be worked out again when Shift changes.
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

// The pocket openings, as circles. Used for drawing and for snapping arrows.
function getPockets() {
    const { x, y, width, height, cushionWidth, cornerPocketRadius, sidePocketRadius } = poolTable;
    const cornerInset = 8;
    const sideInset = cushionWidth + 2;

    return [
        { x: x - cornerInset, y: y - cornerInset, radius: cornerPocketRadius }, // Top-left
        { x: x + width / 2, y: y - sideInset, radius: sidePocketRadius }, // Top-center
        { x: x + width + cornerInset, y: y - cornerInset, radius: cornerPocketRadius }, // Top-right
        { x: x - cornerInset, y: y + height + cornerInset, radius: cornerPocketRadius }, // Bottom-left
        { x: x + width / 2, y: y + height + sideInset, radius: sidePocketRadius }, // Bottom-center
        { x: x + width + cornerInset, y: y + height + cornerInset, radius: cornerPocketRadius } // Bottom-right
    ];
}

function drawPockets() {
    const { x, y, width, height, cushionWidth, cornerJaw, sideJaw, sideJawTaper } = poolTable;
    const cornerBack = cornerJaw - cushionWidth;
    const sideBack = sideJaw - sideJawTaper;

    ctx.fillStyle = POCKET_COLOR;
    getPockets().forEach(pocket => {
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

// The cue ball at the moment of contact, drawn see-through with a dashed edge
// so it reads differently from the placement preview.
function drawContactGhostBall(ghost) {
    ctx.globalAlpha = GHOST_BALL_ALPHA;
    ctx.fillStyle = BALL_COLORS[CUE_BALL_COLOR];
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = ARROW_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawArrows() {
    const all = draftArrow ? [...arrows, draftArrow] : arrows;
    all.forEach(arrow => {
        if (arrow.ghost) drawContactGhostBall(arrow.ghost);
    });
    all.forEach(drawArrow);
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

// Returns the arrow whose contact ghost ball is nearest the point, if the
// point is on or just around it.
function findGhostArrowAt(x, y) {
    let nearest = null;
    let nearestDistance = BALL_RADIUS + ARROW_GRAB_MARGIN;

    arrows.forEach(arrow => {
        if (!arrow.ghost) return;
        const distance = Math.hypot(arrow.ghost.x - x, arrow.ghost.y - y);
        if (distance <= nearestDistance) {
            nearest = arrow;
            nearestDistance = distance;
        }
    });
    return nearest;
}

canvas.addEventListener('pointerdown', event => {
    if (!arrowModeCheckbox.checked || !event.isPrimary) return;

    const point = toCanvasPoint(event);
    const ball = findBallAt(point.x, point.y);
    const ghostArrow = findGhostArrowAt(point.x, point.y);

    // A ghost ball sits against its object ball, so take whichever is closer.
    if (ghostArrow && (!ball || Math.hypot(ghostArrow.ghost.x - point.x, ghostArrow.ghost.y - point.y) < Math.hypot(ball.x - point.x, ball.y - point.y))) {
        canvas.setPointerCapture(event.pointerId);
        ghostDragArrow = ghostArrow;
        canvas.style.cursor = 'grabbing';
        return;
    }
    if (!ball) return;

    canvas.setPointerCapture(event.pointerId);
    draftArrow = { ball, pointer: point, ...point, target: null, ghost: null };
    drawPool();
});

// Where the cue ball's centre is when it touches `target`, on the side nearest
// `point`. The angle is limited to cuts the cue ball can make without hitting
// the target first: at most acos(2r / distance) either side of a full-ball hit.
// With `snapAngle`, the ghost moves to the nearest multiple of ARROW_ANGLE_STEP
// around the target that is still in range, if there is one.
function limitGhostBall(cue, target, point, snapAngle = false) {
    const contactDistance = BALL_RADIUS * 2;
    const fullBallAngle = Math.atan2(cue.y - target.y, cue.x - target.x);
    const maxCut = Math.acos(Math.min(1, contactDistance / Math.hypot(cue.x - target.x, cue.y - target.y)));
    const offsetFrom = angle => {
        const offset = angle - fullBallAngle;
        return Math.atan2(Math.sin(offset), Math.cos(offset));
    };

    const offset = clamp(offsetFrom(Math.atan2(point.y - target.y, point.x - target.x)), -maxCut, maxCut);
    let angle = fullBallAngle + offset;

    if (snapAngle) {
        // If the nearest snapped angle is out of range, the next one towards a full-ball hit may not be.
        const nearest = Math.round(angle / ARROW_ANGLE_STEP) * ARROW_ANGLE_STEP;
        const nextIn = nearest - Math.sign(offsetFrom(nearest)) * ARROW_ANGLE_STEP;
        const inRange = candidate => Math.abs(offsetFrom(candidate)) <= maxCut + 1e-9;
        angle = [nearest, nextIn].find(inRange) ?? angle;
    }

    return {
        x: target.x + Math.cos(angle) * contactDistance,
        y: target.y + Math.sin(angle) * contactDistance
    };
}

// Where the cue ball touches `target` if it rolls along `direction`, or null if it misses.
function aimGhostBall(cue, target, direction) {
    const contactDistance = BALL_RADIUS * 2;
    const along = (target.x - cue.x) * direction.x + (target.y - cue.y) * direction.y;
    const offsetSquared = Math.hypot(target.x - cue.x, target.y - cue.y) ** 2 - along ** 2;
    if (along <= 0 || offsetSquared > contactDistance ** 2) return null;

    const distance = along - Math.sqrt(contactDistance ** 2 - offsetSquared);
    return { x: cue.x + direction.x * distance, y: cue.y + direction.y * distance };
}

// The arrow from the cue ball stops at the near edge of its ghost ball.
function cueArrowTip(cue, ghost) {
    const distance = Math.hypot(ghost.x - cue.x, ghost.y - cue.y);
    if (distance === 0) return { x: cue.x, y: cue.y };
    return {
        x: ghost.x - ((ghost.x - cue.x) / distance) * BALL_RADIUS,
        y: ghost.y - ((ghost.y - cue.y) / distance) * BALL_RADIUS
    };
}

function moveGhostBall(arrow, point, snapAngle) {
    arrow.ghost = limitGhostBall(arrow.ball, arrow.target, point, snapAngle);
    Object.assign(arrow, cueArrowTip(arrow.ball, arrow.ghost));
    drawPool();
}

function finishGhostDrag(event) {
    if (!ghostDragArrow || !event.isPrimary) return false;
    ghostDragArrow = null;
    ghostDragPointer = null;
    canvas.style.cursor = '';
    return true;
}

// Turns the drag from `ball` to `point` to the nearest snapped angle. The
// pointer is projected onto that direction and kept on the canvas.
function snapToAngle(ball, point) {
    const dx = point.x - ball.x;
    const dy = point.y - ball.y;
    const angle = Math.round(Math.atan2(dy, dx) / ARROW_ANGLE_STEP) * ARROW_ANGLE_STEP;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };

    let length = Math.max(0, dx * direction.x + dy * direction.y);
    if (Math.abs(direction.x) > 1e-9) {
        length = Math.min(length, ((direction.x > 0 ? WIDTH : 0) - ball.x) / direction.x);
    }
    if (Math.abs(direction.y) > 1e-9) {
        length = Math.min(length, ((direction.y > 0 ? HEIGHT : 0) - ball.y) / direction.y);
    }

    return {
        point: { x: ball.x + direction.x * length, y: ball.y + direction.y * length },
        direction
    };
}

// How far along `direction` (a unit vector) from `start` the line first meets
// the circle, or null if it misses or the circle is behind.
function lineEntersCircle(start, direction, center, radius) {
    const along = (center.x - start.x) * direction.x + (center.y - start.y) * direction.y;
    const offsetSquared = Math.hypot(center.x - start.x, center.y - start.y) ** 2 - along ** 2;
    if (along <= 0 || offsetSquared > radius ** 2) return null;
    return along - Math.sqrt(radius ** 2 - offsetSquared);
}

// Returns the pocket the point is over, if any.
function findPocketAt(x, y) {
    return getPockets().find(pocket => Math.hypot(pocket.x - x, pocket.y - y) <= pocket.radius) ?? null;
}

// Over a pocket, the tip stops at the pocket's near edge so the head stays
// visible against it. Aimed at its centre, or along a fixed `direction` (Shift
// held), where it doesn't snap if the line misses the pocket.
function pocketTip(ball, pocket, direction) {
    if (!direction) {
        const distance = Math.hypot(pocket.x - ball.x, pocket.y - ball.y);
        if (distance <= pocket.radius) return null;
        direction = { x: (pocket.x - ball.x) / distance, y: (pocket.y - ball.y) / distance };
    }
    const distance = lineEntersCircle(ball, direction, pocket, pocket.radius);
    if (distance === null) return null;
    return { x: ball.x + direction.x * distance, y: ball.y + direction.y * distance, target: null, ghost: null };
}

// Works out where an arrow from `ball` dragged to `point` ends. Over another
// ball, the tip snaps to that ball's near edge, aimed at its centre. With a
// fixed `direction` (Shift held), the tip instead stops where that line enters
// the ball, and doesn't snap if the line misses it. From the cue ball, the tip
// stops at a ghost ball touching the target instead. Over a pocket, the tip
// snaps to the pocket's edge (`pocketTip`).
function arrowTip(ball, point, direction = null) {
    const target = findBallAt(point.x, point.y, ball);
    if (!target) {
        const pocket = findPocketAt(point.x, point.y);
        const tip = pocket && pocketTip(ball, pocket, direction);
        if (tip) return tip;
        // Keeps the tip on the canvas, so the head is never cut off.
        return { x: clamp(point.x, 0, WIDTH), y: clamp(point.y, 0, HEIGHT), target: null, ghost: null };
    }

    if (ball.color === CUE_BALL_COLOR) {
        // Without Shift, start from a full-ball hit, aimed at the target's centre.
        const ghost = direction ? aimGhostBall(ball, target, direction) : limitGhostBall(ball, target, ball);
        if (!ghost) return { x: point.x, y: point.y, target: null, ghost: null };
        return { ...cueArrowTip(ball, ghost), target, ghost };
    }

    if (!direction) {
        const distance = Math.hypot(target.x - ball.x, target.y - ball.y);
        return {
            x: target.x - ((target.x - ball.x) / distance) * BALL_RADIUS,
            y: target.y - ((target.y - ball.y) / distance) * BALL_RADIUS,
            target,
            ghost: null
        };
    }

    // Where the line from the ball's centre first meets the target's edge
    const distance = lineEntersCircle(ball, direction, target, BALL_RADIUS);
    if (distance === null) return { x: point.x, y: point.y, target: null, ghost: null };
    return { x: ball.x + direction.x * distance, y: ball.y + direction.y * distance, target, ghost: null };
}

// Recalculates the tip of the arrow being drawn from the pointer position.
function updateDraftArrow(snapAngle) {
    const { ball, pointer } = draftArrow;
    let tip;
    if (snapAngle) {
        const { point, direction } = snapToAngle(ball, pointer);
        tip = arrowTip(ball, point, direction);
    } else {
        tip = arrowTip(ball, pointer);
    }

    draftArrow = { ball, pointer, ...tip };
    drawPool();
}

function finishArrow(event, keep) {
    if (finishGhostDrag(event) || !draftArrow || !event.isPrimary) return;

    const { ball, x, y, target, ghost } = draftArrow;
    if (keep && Math.hypot(x - ball.x, y - ball.y) >= MIN_ARROW_LENGTH) {
        arrows = [...arrows, { ball, x, y, target, ghost }];
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
        draftArrow.pointer = toCanvasPoint(event);
        updateDraftArrow(event.shiftKey);
        return;
    }
    if (ghostDragArrow && event.isPrimary) {
        ghostDragPointer = toCanvasPoint(event);
        moveGhostBall(ghostDragArrow, ghostDragPointer, event.shiftKey);
        return;
    }
    if (event.pointerType === 'touch') return;
    cursor = toCanvasPoint(event);
    // Shows that a ghost ball can be dragged.
    canvas.style.cursor = arrowModeCheckbox.checked && findGhostArrowAt(cursor.x, cursor.y) ? 'grab' : '';
    drawPool();
});

// Pressing or releasing Shift mid-drag updates the arrow or ghost ball without moving the pointer.
['keydown', 'keyup'].forEach(type => {
    window.addEventListener(type, event => {
        if (event.key !== 'Shift') return;
        if (draftArrow) updateDraftArrow(event.shiftKey);
        if (ghostDragArrow && ghostDragPointer) moveGhostBall(ghostDragArrow, ghostDragPointer, event.shiftKey);
    });
});

canvas.addEventListener('pointerleave', () => {
    cursor = null;
    drawPool();
});

snapCheckbox.addEventListener('change', drawPool);

arrowModeCheckbox.addEventListener('change', () => {
    canvas.classList.toggle('arrow-mode', arrowModeCheckbox.checked);
    draftArrow = null;
    ghostDragArrow = null;
    ghostDragPointer = null;
    canvas.style.cursor = '';
    drawPool();
});

const ballPickers = document.querySelectorAll('.ball-picker');
ballPickers.forEach(picker => {
    picker.style.backgroundColor = BALL_COLORS[picker.dataset.color];
    picker.style.borderColor = ballEdgeColor(picker.dataset.color);
    picker.addEventListener('click', () => {
        selectedColor = picker.dataset.color;
        ballPickers.forEach(other => other.classList.toggle('selected', other === picker));
        // Picking a ball means placing it, so leave arrow mode. Setting `checked`
        // doesn't fire `change`, so fire it to run the usual clean-up.
        if (arrowModeCheckbox.checked) {
            arrowModeCheckbox.checked = false;
            arrowModeCheckbox.dispatchEvent(new Event('change'));
        }
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
