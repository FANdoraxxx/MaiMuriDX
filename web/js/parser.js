/**
 * parser.js
 * Port of majparse.py SimaiParser.parse_simai_chart for the browser.
 * Parses a simai chart string into an array of note objects.
 */

// ==================== Note Type Constants ====================
const NoteType = {
    TAP: 'tap',
    HOLD: 'hold',
    TOUCH: 'touch',
    TOUCH_HOLD: 'touchhold',
    TOUCH_GROUP: 'touchgroup',
    SLIDE: 'slide',
    WIFI: 'wifi',
};

// ==================== Note Classes ====================

class SimaiNote {
    constructor(type, moment, cursor) {
        this.type = type;
        this.moment = moment;   // in ticks (JUDGE_TPS = 180)
        this.cursor = cursor;   // [line, col, str]
        this.isEach = false;    // set to true by post-processing
        this.isBreak = false;
    }
}

class TapNote extends SimaiNote {
    constructor(moment, cursor, padIdx, isBreak = false, isSlideHead = false, isStar = false) {
        super(NoteType.TAP, moment, cursor);
        this.padIdx = padIdx;       // 1-8
        this.isBreak = isBreak;
        this.isSlideHead = isSlideHead;
        this.isStar = isStar;       // is this a slide head (star visual)
        this.endMoment = moment;
    }
}

class HoldNote extends SimaiNote {
    constructor(moment, cursor, padIdx, duration) {
        super(NoteType.HOLD, moment, cursor);
        this.padIdx = padIdx;
        this.duration = duration;
        this.endMoment = moment + duration;
    }
}

class TouchNote extends SimaiNote {
    constructor(moment, cursor, padStr, onSlide = false) {
        super(NoteType.TOUCH, moment, cursor);
        this.padStr = padStr;   // 'A1', 'B3', 'C', etc.
        this.onSlide = onSlide;
        this.endMoment = moment + TOUCH_DURATION;
    }
}

class TouchHoldNote extends SimaiNote {
    constructor(moment, cursor, padStr, duration) {
        super(NoteType.TOUCH_HOLD, moment, cursor);
        this.padStr = padStr;
        this.duration = duration;
        this.endMoment = moment + duration;
    }
}

class TouchGroupNote extends SimaiNote {
    constructor(moment, cursor, children) {
        super(NoteType.TOUCH_GROUP, moment, cursor);
        this.children = children; // array of TouchNote
        this.endMoment = moment + TOUCH_DURATION;
    }
}

class SlideNote extends SimaiNote {
    /**
     * @param {number} moment - when track appears (ticks)
     * @param {string[]} shapes - e.g. ["3-5", "5-7"]
     * @param {number} waitDuration - ticks before star shoots
     * @param {number[]} durations - per-segment travel durations in ticks
     */
    constructor(moment, cursor, shapes, waitDuration, durations) {
        super(NoteType.SLIDE, moment, cursor);
        this.shapes = shapes;
        this.waitDuration = waitDuration;
        this.shootMoment = moment + waitDuration;
        this.durations = durations;
        this.totalDuration = durations.reduce((a, b) => a + b, 0);
        this.endMoment = this.shootMoment + this.totalDuration;
        this.startPad = parseInt(shapes[0][0]);
        // available_moment: track becomes visible 50ms before star is hit
        const SLIDE_LEADING = JUDGE_TPF * 5;
        this.availableMoment = moment - SLIDE_LEADING;
    }
}

class WifiNote extends SimaiNote {
    constructor(moment, cursor, shape, waitDuration, duration) {
        super(NoteType.WIFI, moment, cursor);
        this.shape = shape;        // e.g. "3w7"
        this.waitDuration = waitDuration;
        this.shootMoment = moment + waitDuration;
        this.duration = duration;
        this.endMoment = this.shootMoment + duration;
        this.startPad = parseInt(shape[0]);
        const SLIDE_LEADING = JUDGE_TPF * 5;
        this.availableMoment = moment - SLIDE_LEADING;
    }
}

// ==================== Parser ====================

const FAKE_HOLD_DURATION = JUDGE_TPF * 1; // 3 ticks

class SimaiParser {
    static _parseHoldDuration(sig, bpm) {
        if ((sig.match(/#/g) || []).length > 1) throw new Error(`invalid hold: ${sig}`);

        if (sig.includes('#')) {
            const [str1, str2] = sig.split('#', 2);
            if (str1 === '') {
                return parseFloat(str2) * JUDGE_TPS;
            }
            if (!str2.includes(':')) throw new Error(`invalid hold: ${sig}`);
            const [a, b] = str2.split(':', 2);
            return 240 * parseInt(b) / (parseFloat(str1) * parseInt(a)) * JUDGE_TPS;
        }

        if (!sig.includes(':')) throw new Error(`invalid hold: ${sig}`);
        const [a, b] = sig.split(':', 2);
        return 240 * parseInt(b) / (bpm * parseInt(a)) * JUDGE_TPS;
    }

    static _parseSlideWaitAndDuration(sig, bpm) {
        const hashCount = (sig.match(/#/g) || []).length;
        if (hashCount > 3 || sig.includes('###')) throw new Error(`invalid slide: ${sig}`);

        if (sig.includes('##')) {
            const [str1, rest] = sig.split('##', 2);
            const wait = parseFloat(str1) * JUDGE_TPS;
            if (rest.includes('#')) {
                const [s3, s4] = rest.split('#', 2);
                const [a, b] = s4.split(':', 2);
                return [wait, 240 * parseInt(b) / (parseFloat(s3) * parseInt(a)) * JUDGE_TPS];
            }
            if (rest.includes(':')) {
                const [a, b] = rest.split(':', 2);
                return [wait, 240 * parseInt(b) / (bpm * parseInt(a)) * JUDGE_TPS];
            }
            return [wait, parseFloat(rest) * JUDGE_TPS];
        }

        if (sig.includes('#')) {
            const [str1, str2] = sig.split('#', 2);
            const tempbpm = parseFloat(str1);
            const wait = 60 / tempbpm * JUDGE_TPS;
            if (str2.includes(':')) {
                const [a, b] = str2.split(':', 2);
                return [wait, 240 * parseInt(b) / (tempbpm * parseInt(a)) * JUDGE_TPS];
            }
            return [wait, parseFloat(str2) * JUDGE_TPS];
        }

        if (!sig.includes(':')) throw new Error(`invalid slide: ${sig}`);
        const [a, b] = sig.split(':', 2);
        return [60 / bpm * JUDGE_TPS, 240 * parseInt(b) / (bpm * parseInt(a)) * JUDGE_TPS];
    }

    static _parseSlideNote(cursor, slideStr, now, bpm) {
        if (!slideStr.includes('[') || !slideStr.includes(']')) return [];

        // Wifi slide
        if (slideStr.includes('w')) {
            const wi = slideStr.indexOf('w');
            const bi = slideStr.indexOf('[');
            const ci = slideStr.indexOf(']');
            const shape = slideStr[0] + slideStr.slice(wi, wi + 2);
            const sig = slideStr.slice(bi + 1, ci);
            try {
                const [wait, duration] = this._parseSlideWaitAndDuration(sig, bpm);
                return [new WifiNote(now, cursor, shape, wait, duration)];
            } catch (e) {
                return [];
            }
        }

        // Regular slide (possibly chained)
        const charIter = [...slideStr];
        let lastTarget = charIter[0];
        const shapes = [];
        const waitAndDurations = [];
        let shapeFound = false;
        let sigState = 0; // 0=begin, 1=total dur, 2=individual, 3=total confirmed

        let i = 1;
        while (i < charIter.length) {
            const ch = charIter[i++];

            if (ch === '[') {
                if (!shapeFound) return [];
                shapeFound = false;
                if (sigState === 0) sigState = 2;
                else if (sigState === 1) sigState = 3;
                else if (sigState === 3) return [];

                let sig = '';
                while (i < charIter.length) {
                    const ch2 = charIter[i++];
                    if (ch2 === ']') break;
                    sig += ch2;
                }
                try {
                    const [w, d] = this._parseSlideWaitAndDuration(sig, bpm);
                    waitAndDurations.push([w, d]);
                } catch (e) {
                    return [];
                }
                continue;
            }

            if ('-^v<>Vpqsz'.includes(ch)) {
                if (sigState === 3) return [];
                if (shapeFound) {
                    if (sigState === 0) sigState = 1;
                    else if (sigState === 2) return [];
                }
                shapeFound = true;

                if (ch === 'V') {
                    const mid = charIter[i++];
                    const end = charIter[i++];
                    shapes.push(lastTarget + ch + mid + end);
                    lastTarget = end;
                } else if (ch === 'p' || ch === 'q') {
                    const nxt = charIter[i++];
                    if (nxt === ch) {
                        // pp/qq
                        const end = charIter[i++];
                        shapes.push(lastTarget + ch + nxt + end);
                        lastTarget = end;
                    } else {
                        shapes.push(lastTarget + ch + nxt);
                        lastTarget = nxt;
                    }
                } else {
                    const end = charIter[i++];
                    shapes.push(lastTarget + ch + end);
                    lastTarget = end;
                }
            }
        }

        if (shapes.length === 0) return [];

        const wait = waitAndDurations.length > 0 ? waitAndDurations[0][0] : 0;

        if (sigState === 2) {
            // Individual durations for each segment
            const durations = waitAndDurations.map(([, d]) => d);
            return [new SlideNote(now, cursor, shapes, wait, durations)];
        }

        if (sigState === 3) {
            // Total duration, divide by path lengths
            const totalDur = waitAndDurations[0][1];
            // Rough equal split (we don't have path lengths in JS easily)
            const durations = shapes.map(() => totalDur / shapes.length);
            return [new SlideNote(now, cursor, shapes, wait, durations)];
        }

        return [];
    }

    static _parseNote(cursor, noteStr, now, bpm) {
        if (!noteStr) return [];

        // Pure digits = simple taps (each omitted)
        if (/^[1-8]+$/.test(noteStr)) {
            const result = [];
            const baseCol = cursor[1] - noteStr.length;
            for (let i = 0; i < noteStr.length; i++) {
                const padIdx = parseInt(noteStr[i]);
                result.push(new TapNote(now, [cursor[0], baseCol + i + 1, noteStr[i]], padIdx));
            }
            return result;
        }

        // Touch note (starts with A/B/C/D/E)
        if (noteStr[0] === 'C' || ('ABDE'.includes(noteStr[0]) && noteStr.length > 1 && '12345678'.includes(noteStr[1]))) {
            const padStr = noteStr[0] === 'C' ? 'C' : noteStr.slice(0, 2);

            if (noteStr.includes('h') && noteStr.includes('[') && noteStr.includes(']')) {
                const bi = noteStr.indexOf('[');
                const ci = noteStr.indexOf(']');
                const sig = noteStr.slice(bi + 1, ci);
                try {
                    const duration = this._parseHoldDuration(sig, bpm);
                    if (duration <= FAKE_HOLD_DURATION) {
                        return [new TouchNote(now, cursor, padStr)];
                    }
                    return [new TouchHoldNote(now, cursor, padStr, duration)];
                } catch (e) {
                    return [new TouchNote(now, cursor, padStr)];
                }
            }
            return [new TouchNote(now, cursor, padStr)];
        }

        if (!'12345678'.includes(noteStr[0])) return [];

        const padIdx = parseInt(noteStr[0]);

        // Slide note
        if (/[-^v<>Vpqszw]/.test(noteStr)) {
            let result = [];
            // Headless slide?
            const isHeadless = noteStr.includes('?') || noteStr.includes('!');
            if (!isHeadless) {
                // Extract the tap head
                let s = '';
                let col = cursor[1] - noteStr.length;
                for (const c of noteStr) {
                    if ('-^v<>Vpqszw'.includes(c)) break;
                    s += c;
                    col++;
                }
                result.push(new TapNote(now, [cursor[0], col, s + '_'], padIdx, false, true, true));
            }

            // Same-head slides (star *)
            if (noteStr.includes('*')) {
                const parts = noteStr.split('*');
                const first = parts[0];
                let col = cursor[1] - noteStr.length + first.length;
                result = result.concat(this._parseSlideNote([cursor[0], col, first], first, now, bpm));
                for (let k = 1; k < parts.length; k++) {
                    col += 1 + parts[k].length;
                    const s = noteStr[0] + parts[k];
                    result = result.concat(this._parseSlideNote([cursor[0], col, '*' + s], s, now, bpm));
                }
            } else {
                result = result.concat(this._parseSlideNote(cursor, noteStr, now, bpm));
            }
            return result;
        }

        // Hold note
        if (noteStr.includes('h') && noteStr.includes('[') && noteStr.includes(']')) {
            const bi = noteStr.indexOf('[');
            const ci = noteStr.indexOf(']');
            const sig = noteStr.slice(bi + 1, ci);
            try {
                const duration = this._parseHoldDuration(sig, bpm);
                if (duration <= FAKE_HOLD_DURATION) return [new TapNote(now, cursor, padIdx)];
                // Check for break hold
                const isBreak = noteStr.includes('b');
                return [new HoldNote(now, cursor, padIdx, duration)];
            } catch (e) {
                return [new TapNote(now, cursor, padIdx)];
            }
        }

        // Plain tap (possibly with modifiers b, x, $, etc.)
        const isBreak = noteStr.includes('b');
        return [new TapNote(now, cursor, padIdx, isBreak)];
    }

    /**
     * Determine if two touch pads are "next to" each other for grouping purposes.
     * Simplified version for grouping purposes.
     */
    static _padsNextTo(p1Str, p2Str) {
        if (p1Str === p2Str) return false;
        if (p1Str === 'C' || p2Str === 'C') {
            // C is next to all B pads
            const other = p1Str === 'C' ? p2Str : p1Str;
            return other[0] === 'B';
        }
        const g1 = p1Str[0], g2 = p2Str[0];
        const i1 = parseInt(p1Str[1]), i2 = parseInt(p2Str[1]);

        // B-B adjacency
        if (g1 === 'B' && g2 === 'B') {
            const diff = Math.abs(i1 - i2);
            return diff === 1 || diff === 7;
        }
        // A-B or D-E adjacency (same index)
        if ((g1 === 'A' && g2 === 'B') || (g1 === 'B' && g2 === 'A') ||
            (g1 === 'D' && g2 === 'E') || (g1 === 'E' && g2 === 'D')) {
            return i1 === i2;
        }
        // A-D, A-E, B-E adjacency
        if ((g1 === 'A' && g2 === 'D') || (g1 === 'D' && g2 === 'A') ||
            (g1 === 'A' && g2 === 'E') || (g1 === 'E' && g2 === 'A') ||
            (g1 === 'B' && g2 === 'E') || (g1 === 'E' && g2 === 'B')) {
            const diff = Math.abs(i1 - i2);
            return diff === 0 || diff === 1 || diff === 7;
        }
        return false;
    }

    static _workupEach(eachList) {
        const nonTouch = eachList.filter(n => n.type !== NoteType.TOUCH);
        const touches = eachList.filter(n => n.type === NoteType.TOUCH);

        if (touches.length <= 1) return [...nonTouch, ...touches];

        // Group adjacent touches using union-find
        const parent = touches.map((_, i) => i);
        const find = (i) => {
            while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
            return i;
        };
        for (let a = 0; a < touches.length; a++) {
            for (let b = a + 1; b < touches.length; b++) {
                if (this._padsNextTo(touches[a].padStr, touches[b].padStr)) {
                    const pa = find(a), pb = find(b);
                    if (pa !== pb) parent[pa] = pb;
                }
            }
        }

        const groups = {};
        for (let i = 0; i < touches.length; i++) {
            const root = find(i);
            if (!groups[root]) groups[root] = [];
            groups[root].push(i);
        }

        const refined = [];
        for (const group of Object.values(groups)) {
            if (group.length === 1) {
                refined.push(touches[group[0]]);
            } else {
                const children = group.map(i => touches[i]);
                const grpCursor = [children[0].cursor[0], children[0].cursor[1],
                    children.map(t => t.cursor[2]).join('/')];
                refined.push(new TouchGroupNote(children[0].moment, grpCursor, children));
            }
        }
        return [...nonTouch, ...refined];
    }

    /**
     * Main parsing function. Returns array of note objects sorted by moment.
     * @param {string} chartStr - the raw chart text (e.g. contents of inote_X)
     * @param {number} first - offset in seconds before chart starts
     * @returns {SimaiNote[]}
     */
    static parseChart(chartStr, first = 0) {
        const lines = chartStr.split('\n');

        let bpm = 120;
        let beats = 4;
        let now = first * JUDGE_TPS;
        let haveNote = false;
        let currentNote = '';
        let currentEach = [];
        const result = [];

        for (let lineno = 0; lineno < lines.length; lineno++) {
            const line = lines[lineno];
            const length = line.length;
            let column = 0;

            while (column < length) {
                const ch = line[column];

                // Comments
                if (ch === '|' && column + 1 < length && line[column + 1] === '|') {
                    break;
                }

                column++;

                if (/\s/.test(ch)) continue;

                if (ch === '(') {
                    // BPM definition
                    haveNote = false; currentNote = '';
                    let temp = '';
                    while (column < length) {
                        const ch2 = line[column++];
                        if (ch2 === ')') break;
                        temp += ch2;
                    }
                    const val = parseFloat(temp);
                    if (!isNaN(val) && val > 0) bpm = val;
                    continue;
                }

                if (ch === '{') {
                    // Beats definition
                    haveNote = false; currentNote = '';
                    let temp = '';
                    while (column < length) {
                        const ch2 = line[column++];
                        if (ch2 === '}') break;
                        temp += ch2;
                    }
                    const val = parseInt(temp);
                    if (!isNaN(val) && val > 0) beats = val;
                    continue;
                }

                // HS* skip
                if (ch === 'H' && column < length && line[column] === 'S' && column + 1 < length && line[column + 1] === '*') {
                    haveNote = false; currentNote = '';
                    while (column < length) {
                        if (line[column++] === '>') break;
                    }
                    continue;
                }

                if (ch === ',' || ch === '/' || ch === '`') {
                    if (haveNote) {
                        const noteList = this._parseNote([lineno + 1, column, currentNote], currentNote, now, bpm);
                        if (ch === '/') {
                            currentEach = currentEach.concat(noteList);
                        } else {
                            currentEach = currentEach.concat(noteList);
                            result.push(...this._workupEach(currentEach));
                            currentEach = [];
                        }
                    } else if (ch !== '/' && ch !== '`') {
                        // empty time slot still advances time
                    }
                    haveNote = false;
                    currentNote = '';

                    if (ch === ',') {
                        now += 240 / (bpm * beats) * JUDGE_TPS;
                    }
                    continue;
                }

                if ('12345678ABCDE'.includes(ch)) {
                    haveNote = true;
                }
                if (haveNote) {
                    currentNote += ch;
                }
            }
        }

        // Mark each notes (same moment = each)
        this._markEachNotes(result);

        result.sort((a, b) => a.moment - b.moment);
        return result;
    }

    /**
     * Mark notes that share the same moment as "each" (for visual coloring).
     */
    static _markEachNotes(notes) {
        const byMoment = {};
        for (const note of notes) {
            const key = Math.round(note.moment * 100);
            if (!byMoment[key]) byMoment[key] = [];
            byMoment[key].push(note);
        }
        for (const group of Object.values(byMoment)) {
            // Filter to non-slide notes only for each detection
            const nonSlide = group.filter(n => n.type !== NoteType.SLIDE && n.type !== NoteType.WIFI);
            if (nonSlide.length >= 2) {
                for (const n of nonSlide) n.isEach = true;
            }
        }
    }
}

/**
 * Parse the full maidata.txt file.
 * Returns { title, artist, first, difficulties: { '1':..., '2':..., ..., '7':... } }
 */
function parseMaidata(text) {
    const result = {
        title: '',
        artist: '',
        first: 0,
        difficulties: {}
    };

    // Split by & and process each section
    const sections = text.split('&');
    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('title=')) {
            result.title = trimmed.slice(6);
        } else if (trimmed.startsWith('artist=')) {
            result.artist = trimmed.slice(7);
        } else if (trimmed.startsWith('first=')) {
            const val = parseFloat(trimmed.slice(6));
            if (!isNaN(val)) result.first = val;
        } else if (/^inote_[1-7]=/.test(trimmed)) {
            const diff = trimmed[6];
            result.difficulties[diff] = trimmed.slice(8); // after "inote_X="
        }
    }

    return result;
}
