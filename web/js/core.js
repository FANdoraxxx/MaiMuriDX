// ==================== Constants ====================
const CANVAS_SIZE = 540;
const CANVAS_CENTER_X = 270;
const CANVAS_CENTER_Y = 270;
const MAIN_SCALE = 0.5; // CANVAS_SIZE / 1080

// Radii (540px canvas)
const RADIUS_A = CANVAS_SIZE * 100 / 1080;   // 50
const RADIUS_B = CANVAS_SIZE * 75 / 1080;    // 37.5
const RADIUS_C = CANVAS_SIZE * 105 / 1080;   // 52.5
const RADIUS_D = CANVAS_SIZE * 65 / 1080;    // 32.5
const RADIUS_E = CANVAS_SIZE * 60 / 1080;    // 30

// Distances from center (540px canvas)
const DISTANCE_A = CANVAS_SIZE * 410 / 1080; // 205
const DISTANCE_B = CANVAS_SIZE * 220 / 1080; // 110
const DISTANCE_D = CANVAS_SIZE * 440 / 1080; // 220
const DISTANCE_E = CANVAS_SIZE * 310 / 1080; // 155

const DISTANCE_TAP = CANVAS_SIZE * 122.5 / 1080; // 61.25
const DISTANCE_EDGE = CANVAS_SIZE * 480 / 1080;  // 240

// Judging definitions
const JUDGE_TPF = 3;
const JUDGE_TPS = JUDGE_TPF * 60; // 180 ticks per second

// Rendering definitions
const NOTE_SPEED = 9 / JUDGE_TPF; // 3 px/tick
const TOUCH_DURATION = 30 * JUDGE_TPF; // 90 ticks

// Note sizes (used in renderer)
const NOTE_RADIUS = 22;   // base tap/hold note radius at scale 1.0
const STAR_SIZE = 18;     // slide star size
const TOUCH_RING_RADIUS = 27; // touch note ring radius

// ==================== Math Helpers ====================
function angle2vec(multipleOf22deg5) {
    const rad = (((multipleOf22deg5 % 16) * 22.5) - 135) * Math.PI / 180;
    return { x: Math.cos(rad), y: Math.sin(rad) };
}

const UNITVEC_A = Array.from({ length: 8 }, (_, i) => angle2vec(2 * i + 1));
const UNITVEC_D = Array.from({ length: 8 }, (_, i) => angle2vec(2 * i));

// ==================== Pad Definitions ====================
class Pad {
    constructor(name, group, idx) {
        this.name = name;
        this.group = group; // 0=A, 1=B, 2=D, 3=E, 4=C
        this.idx = idx;     // 0-7 (A8=0, A1=1, ..., A7=7)

        if (group === 4) {
            // C pad
            this.unitvec = { x: 0, y: 0 };
            this.vec = { x: 0, y: 0 };
            this.radius = RADIUS_C;
        } else if (group === 0) {
            this.unitvec = UNITVEC_A[idx];
            this.vec = { x: this.unitvec.x * DISTANCE_A, y: this.unitvec.y * DISTANCE_A };
            this.radius = RADIUS_A;
        } else if (group === 1) {
            this.unitvec = UNITVEC_A[idx];
            this.vec = { x: this.unitvec.x * DISTANCE_B, y: this.unitvec.y * DISTANCE_B };
            this.radius = RADIUS_B;
        } else if (group === 2) {
            this.unitvec = UNITVEC_D[idx];
            this.vec = { x: this.unitvec.x * DISTANCE_D, y: this.unitvec.y * DISTANCE_D };
            this.radius = RADIUS_D;
        } else if (group === 3) {
            this.unitvec = UNITVEC_D[idx];
            this.vec = { x: this.unitvec.x * DISTANCE_E, y: this.unitvec.y * DISTANCE_E };
            this.radius = RADIUS_E;
        }
    }

    /** Rotate by deg45 steps clockwise (each step = 45°) */
    rotate45cw(deg45) {
        if (this.group === 4) return this; // C pad unchanged
        const newIdx = (this.idx + deg45) & 7;
        return PAD_BY_NAME[this.name[0] + (((newIdx) % 8) + 1 === 9 ? 1 : ((newIdx) % 8) + 1)];
    }
}

// Build pad registry
// Note: In Python, A8=0, A1=1, ..., A7=7
// So idx mapping: pad number N -> idx = N % 8
// A1 -> idx 1, A2 -> idx 2, ..., A8 -> idx 0
const PAD_BY_NAME = {};
for (let n = 1; n <= 8; n++) {
    const idx = n % 8;  // A8=0, A1=1, ..., A7=7
    PAD_BY_NAME[`A${n}`] = new Pad(`A${n}`, 0, idx);
    PAD_BY_NAME[`B${n}`] = new Pad(`B${n}`, 1, idx);
    PAD_BY_NAME[`D${n}`] = new Pad(`D${n}`, 2, idx);
    PAD_BY_NAME[`E${n}`] = new Pad(`E${n}`, 3, idx);
}
PAD_BY_NAME['C'] = new Pad('C', 4, 0);

/**
 * Get position in canvas coordinates for a given tap pad index (1-8).
 * padIdx: 1-8 (pad number), dist: distance from center
 */
function getPadUnitvec(padIdx) {
    // padIdx 1-8, maps to UNITVEC_A[padIdx % 8]
    return UNITVEC_A[padIdx % 8];
}

/**
 * Transform a point from SVG 1080x1080 space to canvas 540x540 space.
 * Uses the slide path transformation math.
 */
function transformSvgPoint(px, py, isReflect, rotateDeg45) {
    let cx = px - 540;
    let cy = py - 540;
    if (isReflect) cy = -cy;
    const theta = (rotateDeg45 * 45 - (isReflect ? 135 : 0)) * Math.PI / 180;
    const cos_t = Math.cos(theta);
    const sin_t = Math.sin(theta);
    return {
        x: (cx * cos_t - cy * sin_t) * 0.5 + CANVAS_CENTER_X,
        y: (cx * sin_t + cy * cos_t) * 0.5 + CANVAS_CENTER_Y
    };
}

/**
 * distance2scale: note visual scale based on distance from center.
 * In Python: distance * 0.008 + 0.51
 */
function distance2scale(distance) {
    return distance * 0.008 + 0.51;
}

/**
 * Get canvas position for a tap note at given distance from center, for pad index padIdx (1-8).
 */
function getTapPosition(padIdx, distance) {
    const uv = getPadUnitvec(padIdx);
    return {
        x: CANVAS_CENTER_X + uv.x * distance,
        y: CANVAS_CENTER_Y + uv.y * distance
    };
}
