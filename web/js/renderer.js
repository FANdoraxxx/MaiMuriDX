/**
 * renderer.js
 * Canvas-based renderer for maimai notes.
 * Ports the visual logic from render.py using HTML5 Canvas 2D API.
 */

// ==================== SVG Path Helper ====================
// Hidden SVG for path length/point computations
const _svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
_svgContainer.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;overflow:hidden';
document.body.appendChild(_svgContainer);

const _svgPathCache = {};

function _getSvgPathEl(d) {
    if (!_svgPathCache[d]) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        el.setAttribute('d', d);
        _svgContainer.appendChild(el);
        _svgPathCache[d] = el;
    }
    return _svgPathCache[d];
}

/** Get total length of an SVG path string */
function svgPathLength(d) {
    return _getSvgPathEl(d).getTotalLength();
}

/** Get point at proportion t (0–1) along an SVG path string in SVG-space coords */
function svgPathPoint(d, t) {
    const el = _getSvgPathEl(d);
    const len = el.getTotalLength();
    return el.getPointAtLength(Math.max(0, Math.min(1, t)) * len);
}

/** Get tangent at proportion t along an SVG path string (in SVG-space) */
function svgPathTangent(d, t) {
    const eps = 0.001;
    const t1 = Math.max(0, t - eps);
    const t2 = Math.min(1, t + eps);
    const el = _getSvgPathEl(d);
    const len = el.getTotalLength();
    const p1 = el.getPointAtLength(t1 * len);
    const p2 = el.getPointAtLength(t2 * len);
    return { x: p2.x - p1.x, y: p2.y - p1.y };
}

/** Transform SVG-space point to canvas-space using slide rotation/reflection */
function svgToCanvas(svgPt, isReflect, rotateDeg45) {
    return transformSvgPoint(svgPt.x, svgPt.y, isReflect, rotateDeg45);
}

// ==================== Color Palette ====================
const COLORS = {
    tap:           '#ffffff',
    tapStroke:     '#dddddd',
    each:          '#ffe040',   // yellow for each notes
    eachStroke:    '#ffb300',
    break:         '#ff7043',   // orange-red for break notes
    breakStroke:   '#e64a19',
    slideHead:     '#64b5f6',   // light blue for slide heads
    slideHeadStroke: '#1976d2',
    hold:          '#f48fb1',   // pink for holds
    holdBar:       '#f48fb1',
    holdBarCenter: '#ffffff',
    touch:         '#aed581',   // light green for touch
    touchStroke:   '#689f38',
    touchSlide:    '#80deea',   // cyan-ish for slide-touch
    slideTrack:    'rgba(255,255,255,0.7)',
    slideStar:     '#ffffff',
    wifiTrack:     'rgba(255,255,255,0.65)',
    wifiStar:      '#ffffff',
    background:    '#1a1a2e',
    bgCircle:      '#16213e',
    gridLine:      'rgba(255,255,255,0.15)',
    outerRing:     'rgba(255,255,255,0.4)',
    judgeRing:     'rgba(255,255,255,0.5)',
};

// ==================== Background ====================

function drawBackground(ctx) {
    // Dark background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Outer ring (at DISTANCE_EDGE from center = judge line)
    ctx.beginPath();
    ctx.arc(CANVAS_CENTER_X, CANVAS_CENTER_Y, DISTANCE_EDGE, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.judgeRing;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner ring (at DISTANCE_A = A pad positions)
    ctx.beginPath();
    ctx.arc(CANVAS_CENTER_X, CANVAS_CENTER_Y, DISTANCE_A, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Middle ring (at DISTANCE_B = B pad positions)
    ctx.beginPath();
    ctx.arc(CANVAS_CENTER_X, CANVAS_CENTER_Y, DISTANCE_B, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center dot (C pad)
    ctx.beginPath();
    ctx.arc(CANVAS_CENTER_X, CANVAS_CENTER_Y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();

    // Draw 8 dividing lines from center to outer ring
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        const uv = UNITVEC_A[i];
        ctx.beginPath();
        ctx.moveTo(CANVAS_CENTER_X, CANVAS_CENTER_Y);
        ctx.lineTo(
            CANVAS_CENTER_X + uv.x * DISTANCE_EDGE,
            CANVAS_CENTER_Y + uv.y * DISTANCE_EDGE
        );
        ctx.stroke();
    }

    // Draw pad labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let n = 1; n <= 8; n++) {
        const uv = getPadUnitvec(n);
        const x = CANVAS_CENTER_X + uv.x * (DISTANCE_EDGE - 15);
        const y = CANVAS_CENTER_Y + uv.y * (DISTANCE_EDGE - 15);
        ctx.fillText(String(n), x, y);
    }
}

// ==================== Note Helpers ====================

function getNoteColor(note) {
    if (note.isBreak) return { fill: COLORS.break, stroke: COLORS.breakStroke };
    if (note.isStar || note.isSlideHead) return { fill: COLORS.slideHead, stroke: COLORS.slideHeadStroke };
    if (note.isEach) return { fill: COLORS.each, stroke: COLORS.eachStroke };
    return { fill: COLORS.tap, stroke: COLORS.tapStroke };
}

/** Draw a rounded polygon star shape (for slide stars) */
function drawStar(ctx, x, y, size, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Draw a simple 4-pointed star / diamond arrow
    const s = size;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.4, -s * 0.4);
    ctx.lineTo(s, 0);
    ctx.lineTo(s * 0.4, s * 0.4);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.4, s * 0.4);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-s * 0.4, -s * 0.4);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
}

// ==================== Tap Note ====================

function drawTap(ctx, note, now) {
    const distance = (now - note.moment) * NOTE_SPEED + DISTANCE_EDGE;
    let scale = distance2scale(distance);
    if (scale < 0) return; // not visible yet

    const effectiveDistance = distance < DISTANCE_TAP ? DISTANCE_TAP : distance;
    const pos = getTapPosition(note.padIdx, effectiveDistance);

    // At DISTANCE_TAP, note appears small and zooms in; use scale to set size
    const radius = NOTE_RADIUS * Math.max(0.3, scale);
    const color = getNoteColor(note);

    // Glow
    ctx.shadowColor = color.fill;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color.fill;
    ctx.fill();

    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Star notes: draw a star pattern inside
    if (note.isStar || note.isSlideHead) {
        drawStar(ctx, pos.x, pos.y, radius * 0.6, (22.5 - note.padIdx * 45) * Math.PI / 180, '#ffffff');
    }
}

// ==================== Hold Note ====================

function drawHold(ctx, note, now) {
    const delta = now - note.moment;
    const deltaEnd = now - note.endMoment;
    const distance = delta * NOTE_SPEED + DISTANCE_EDGE;
    const distanceEnd = deltaEnd * NOTE_SPEED + DISTANCE_EDGE;

    const scale = distance2scale(distance);
    if (scale < 0) return;

    // Clamp head to DISTANCE_TAP for zoom-in phase
    const effectiveDist = distance < DISTANCE_TAP ? DISTANCE_TAP : distance;
    // Tail never appears before DISTANCE_TAP either
    const effectiveDistEnd = distanceEnd < DISTANCE_TAP ? DISTANCE_TAP : distanceEnd;

    const uv = getPadUnitvec(note.padIdx);
    const headPos = getTapPosition(note.padIdx, effectiveDist);
    const tailPos = getTapPosition(note.padIdx, effectiveDistEnd);

    // Draw hold bar (line from head to tail)
    if (effectiveDist > effectiveDistEnd) {
        // Draw a rounded rect along the pad direction
        const angle = (22.5 - note.padIdx * 45) * Math.PI / 180;
        const lineLen = effectiveDist - effectiveDistEnd;
        const midDist = (effectiveDist + effectiveDistEnd) / 2;
        const midPos = getTapPosition(note.padIdx, midDist);

        ctx.save();
        ctx.translate(midPos.x, midPos.y);
        ctx.rotate(Math.atan2(uv.y, uv.x) + Math.PI / 2);

        const barWidth = NOTE_RADIUS * 0.45;
        ctx.beginPath();
        ctx.rect(-barWidth, -lineLen / 2, barWidth * 2, lineLen);
        ctx.fillStyle = COLORS.holdBar;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Center line
        ctx.beginPath();
        ctx.moveTo(0, -lineLen / 2);
        ctx.lineTo(0, lineLen / 2);
        ctx.strokeStyle = COLORS.holdBarCenter;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    // Draw head
    const radius = NOTE_RADIUS * Math.max(0.3, scale);
    ctx.shadowColor = COLORS.hold;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(headPos.x, headPos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.hold;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// ==================== Touch Note ====================

function drawTouch(ctx, note, now) {
    const delta = now - note.moment;
    const alpha = Math.min(1, (delta + TOUCH_DURATION) / TOUCH_DURATION * 5);
    if (alpha <= 0) return;

    const pad = PAD_BY_NAME[note.padStr];
    if (!pad) return;
    const cx = CANVAS_CENTER_X + pad.vec.x;
    const cy = CANVAS_CENTER_Y + pad.vec.y;

    // Ring radius: shrinks from large to TOUCH_RING_RADIUS as note arrives
    const ring_r = delta >= 0
        ? TOUCH_RING_RADIUS
        : TOUCH_RING_RADIUS + 30 * Math.max(0, -delta / TOUCH_DURATION);

    const noteColor = note.onSlide ? COLORS.touchSlide : COLORS.touch;

    ctx.globalAlpha = Math.min(1, alpha);
    ctx.shadowColor = noteColor;
    ctx.shadowBlur = 8;

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, ring_r, 0, Math.PI * 2);
    ctx.strokeStyle = noteColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center fill
    ctx.beginPath();
    ctx.arc(cx, cy, ring_r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = noteColor;
    ctx.globalAlpha = alpha * 0.6;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

// ==================== Touch Hold Note ====================

function drawTouchHold(ctx, note, now) {
    const delta = now - note.moment;
    const alpha = Math.min(1, (delta + TOUCH_DURATION) / TOUCH_DURATION * 5);
    if (alpha <= 0) return;

    const pad = PAD_BY_NAME[note.padStr];
    if (!pad) return;
    const cx = CANVAS_CENTER_X + pad.vec.x;
    const cy = CANVAS_CENTER_Y + pad.vec.y;

    const ring_r = TOUCH_RING_RADIUS;

    ctx.globalAlpha = Math.min(1, alpha);
    ctx.shadowColor = COLORS.touch;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.arc(cx, cy, ring_r, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.touch;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, ring_r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.touch;
    ctx.globalAlpha = alpha * 0.7;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Progress arc
    if (delta > 0 && note.duration > 0) {
        const progress = Math.min(1, delta / note.duration);
        ctx.beginPath();
        ctx.arc(cx, cy, ring_r * 1.2, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

// ==================== Touch Group ====================

function drawTouchGroup(ctx, note, now) {
    for (const child of note.children) {
        drawTouch(ctx, child, now);
    }
}

// ==================== Slide Track ====================

/**
 * Draw slide track for a segment given its base SVG path, reflect, rotate.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} svgPath
 * @param {boolean} isReflect
 * @param {number} rotateDeg45
 * @param {number} alpha - track opacity
 */
function drawSlideTrack(ctx, svgPath, isReflect, rotateDeg45, alpha = 1) {
    ctx.save();

    // Apply the slide transform to map SVG 1080-space to canvas 540-space
    const theta = (rotateDeg45 * 45 - (isReflect ? 135 : 0)) * Math.PI / 180;
    ctx.translate(CANVAS_CENTER_X, CANVAS_CENTER_Y);
    ctx.rotate(theta);
    ctx.scale(0.5, isReflect ? -0.5 : 0.5);
    ctx.translate(-540, -540);

    const path2d = new Path2D(svgPath);
    ctx.strokeStyle = COLORS.slideTrack;
    ctx.lineWidth = 8;   // in 1080-space (will be scaled to 4 in 540-space)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = 20;
    ctx.stroke(path2d);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.restore();
}

// ==================== Slide Note ====================

function drawSlide(ctx, note, now) {
    if (now < note.availableMoment) return;

    const fadeIn = Math.min(1, (now - note.availableMoment) * 5 / JUDGE_TPS);
    if (fadeIn <= 0) return;

    // Draw tracks for each segment
    for (let si = 0; si < note.shapes.length; si++) {
        const shape = note.shapes[si];
        const info = getSlideInfo(shape);
        if (!info || info.isWifi) continue;

        // Determine how much of this segment's track to show
        // Full track shown unless slide is mid-progress
        drawSlideTrack(ctx, info.svgPath, info.isReflect, info.rotate, fadeIn);
    }

    // Draw slide star (visible after shootMoment)
    if (now < note.moment) return; // before track even activates fully

    if (now < note.shootMoment) {
        // Star appears at start position, fading in
        const a = Math.min(1, (now - note.moment) / note.waitDuration);
        if (a <= 0) return;
        _drawSlideStarAtProportion(ctx, note.shapes[0], 0, note, a * 0.7 + 0.3);
        return;
    }

    if (now >= note.endMoment) {
        // Star at end position (lingering)
        const lastShape = note.shapes[note.shapes.length - 1];
        _drawSlideStarAtProportion(ctx, lastShape, 1, note, 1);
        return;
    }

    // Find current segment
    let elapsed = now - note.shootMoment;
    let segIdx = 0;
    while (segIdx < note.durations.length - 1 && elapsed > note.durations[segIdx]) {
        elapsed -= note.durations[segIdx];
        segIdx++;
    }
    const proportion = note.durations[segIdx] > 0
        ? Math.min(1, elapsed / note.durations[segIdx])
        : 1;
    _drawSlideStarAtProportion(ctx, note.shapes[segIdx], proportion, note, 1);
}

function _drawSlideStarAtProportion(ctx, shape, proportion, note, alpha) {
    const info = getSlideInfo(shape);
    if (!info || info.isWifi) return;

    const svgPt = svgPathPoint(info.svgPath, proportion);
    const canvasPt = svgToCanvas(svgPt, info.isReflect, info.rotate);

    const tangSvg = svgPathTangent(info.svgPath, proportion);
    // Transform tangent direction
    const theta = (info.rotate * 45 - (info.isReflect ? 135 : 0)) * Math.PI / 180;
    const cos_t = Math.cos(theta);
    const sin_t = Math.sin(theta);
    let tx = tangSvg.x * cos_t - (info.isReflect ? -tangSvg.y : tangSvg.y) * sin_t;
    let ty = tangSvg.x * sin_t + (info.isReflect ? -tangSvg.y : tangSvg.y) * cos_t;
    const starAngle = Math.atan2(ty, tx) + Math.PI / 2;

    ctx.globalAlpha = alpha;
    drawStar(ctx, canvasPt.x, canvasPt.y, STAR_SIZE, starAngle, COLORS.slideStar);
    ctx.globalAlpha = 1;
}

// ==================== Wifi Note ====================

function drawWifi(ctx, note, now) {
    if (now < note.availableMoment) return;

    const fadeIn = Math.min(1, (now - note.availableMoment) * 5 / JUDGE_TPS);
    if (fadeIn <= 0) return;

    const info = getSlideInfo(note.shape);
    if (!info || !info.isWifi) return;

    const { rotate, isReflect } = info;

    // Draw three lanes
    ctx.save();
    const theta = (rotate * 45 - (isReflect ? 135 : 0)) * Math.PI / 180;
    ctx.translate(CANVAS_CENTER_X, CANVAS_CENTER_Y);
    ctx.rotate(theta);
    ctx.scale(0.5, isReflect ? -0.5 : 0.5);
    ctx.translate(-540, -540);

    ctx.strokeStyle = COLORS.wifiTrack;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.globalAlpha = fadeIn * 0.8;
    ctx.shadowColor = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = 15;

    for (const svgKey of [info.svgLeft, info.svgMid, info.svgRight]) {
        ctx.stroke(new Path2D(svgKey));
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    // Draw stars
    if (now < note.moment) return;

    const wifiSvgPaths = [info.svgLeft, info.svgMid, info.svgRight];

    if (now < note.shootMoment) {
        const a = note.waitDuration > 0
            ? Math.min(1, (now - note.moment) / note.waitDuration)
            : 1;
        for (const svgPath of wifiSvgPaths) {
            _drawWifiStar(ctx, svgPath, rotate, isReflect, 0, a * 0.6 + 0.2);
        }
        return;
    }

    if (now >= note.endMoment) {
        for (const svgPath of wifiSvgPaths) {
            _drawWifiStar(ctx, svgPath, rotate, isReflect, 1, 0.8);
        }
        return;
    }

    const proportion = note.duration > 0
        ? Math.min(1, (now - note.shootMoment) / note.duration)
        : 1;
    for (const svgPath of wifiSvgPaths) {
        _drawWifiStar(ctx, svgPath, rotate, isReflect, proportion, 1);
    }
}

function _drawWifiStar(ctx, svgPath, rotateDeg45, isReflect, proportion, alpha) {
    const svgPt = svgPathPoint(svgPath, proportion);
    const canvasPt = svgToCanvas(svgPt, isReflect, rotateDeg45);
    ctx.globalAlpha = alpha;
    drawStar(ctx, canvasPt.x, canvasPt.y, STAR_SIZE * 0.9, 0, COLORS.wifiStar);
    ctx.globalAlpha = 1;
}

// ==================== Main Render Function ====================

/**
 * Render a single frame of the chart.
 * @param {CanvasRenderingContext2D} ctx
 * @param {SimaiNote[]} activeNotes - notes currently visible
 * @param {number} now - current time in ticks
 */
function renderFrame(ctx, activeNotes, now) {
    drawBackground(ctx);

    // Render slides first (below other notes)
    for (const note of activeNotes) {
        if (note.type === NoteType.SLIDE) drawSlide(ctx, note, now);
        else if (note.type === NoteType.WIFI) drawWifi(ctx, note, now);
    }

    // Then render other notes on top
    for (const note of activeNotes) {
        switch (note.type) {
            case NoteType.TAP:         drawTap(ctx, note, now); break;
            case NoteType.HOLD:        drawHold(ctx, note, now); break;
            case NoteType.TOUCH:       drawTouch(ctx, note, now); break;
            case NoteType.TOUCH_HOLD:  drawTouchHold(ctx, note, now); break;
            case NoteType.TOUCH_GROUP: drawTouchGroup(ctx, note, now); break;
        }
    }
}

/**
 * Check if a note should be in the active list at time `now`.
 */
function isNoteActive(note, now) {
    const appearTime = note.moment - APPEAR_LEAD;
    const disappearTime = (note.endMoment || note.moment) + FADE_TRAIL;

    // Slides/wifi use availableMoment for appear time
    if (note.type === NoteType.SLIDE || note.type === NoteType.WIFI) {
        const avail = note.availableMoment - APPEAR_LEAD;
        return now >= avail && now <= disappearTime;
    }

    return now >= appearTime && now <= disappearTime;
}
