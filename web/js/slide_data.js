/**
 * slide_data.js
 * Base SVG path data for all slide shapes (in 1080x1080 coordinate space).
 * Paths start from pad 1 (top-right area). For other starting pads, apply
 * rotation via transformSvgPoint / canvas context transforms.
 */

const BASE_SLIDE_SVG = {
    // ========== Straight ==========
    "1-3": "M723.688,96.538 L983.462,723.688",
    "1-4": "M723.688,96.538 L723.688,983.462",
    "1-5": "M723.688,96.538 L356.312,983.462",
    "1-6": "M723.688,96.538 L96.538,723.688",
    "1-7": "M723.688,96.538 L96.538,356.312",

    // ========== Lightning ==========
    "1s5": "M723.688,96.538 L356.312,463.914 723.688,616.086 356.312,983.462",

    // ========== V-shape ==========
    "1v2": "M723.688,96.538 L540,540 983.462,356.312",
    "1v3": "M723.688,96.538 L540,540 983.462,723.688",
    "1v4": "M723.688,96.538 L540,540 723.688,983.462",
    "1v6": "M723.688,96.538 L540,540 96.538,723.688",
    "1v7": "M723.688,96.538 L540,540 96.538,356.312",
    "1v8": "M723.688,96.538 L540,540 356.312,96.538",

    // ========== L-shape (Grand V) ==========
    "1V72": "M723.688,96.538 L96.538,356.312 983.462,356.312",
    "1V73": "M723.688,96.538 L96.538,356.312 983.462,723.688",
    "1V74": "M723.688,96.538 L96.538,356.312 723.688,983.462",
    "1V75": "M723.688,96.538 L96.538,356.312 356.312,983.462",

    // ========== Circle Arc (CCW) ==========
    "1<1": "M723.688,96.538 A480,480 0 0,0 356.312,983.462 A480,480 0 0,0 723.688,96.538",
    "1<2": "M723.688,96.538 A480,480 0 1,0 983.462,356.312",
    "1<3": "M723.688,96.538 A480,480 0 1,0 983.462,723.688",
    "1<4": "M723.688,96.538 A480,480 0 1,0 723.688,983.462",
    "1<5": "M723.688,96.538 A480,480 0 0,0 356.312,983.462",
    "1<6": "M723.688,96.538 A480,480 0 0,0 96.538,723.688",
    "1<7": "M723.688,96.538 A480,480 0 0,0 96.538,356.312",
    "1<8": "M723.688,96.538 A480,480 0 0,0 356.312,96.538",

    // ========== U-shape Curve (CCW around center) ==========
    "1p1": "M723.688,96.538 L410.113,410.113 A183.688,183.688 0 1,0 723.688,540.000 L723.688,96.538",
    "1p2": "M723.688,96.538 L410.113,410.113 A183.688,183.688 0 0,0 669.887,669.887 L983.462,356.312",
    "1p3": "M723.688,96.538 L410.113,410.113 A183.688,183.688 0 0,0 540.000,723.688 L983.462,723.688",
    "1p4": "M723.688,96.538 L410.113,410.113 A183.688,183.688 0 0,0 410.113,669.887 L723.688,983.462",
    "1p5": "M723.688,96.538 L410.113,410.113 A183.688,183.688 0 0,0 356.312,540.000 L356.312,983.462",
    "1p6": "M723.688,96.538 L410.113,410.113 A183.688,183.688 0 1,0 669.887,669.887 A183.688,183.688 0 1,0 410.113,410.113 L96.538,723.688",
    "1p7": "M723.688,96.538 L410.113,410.113 A183.688,183.688 0 1,0 540.000,356.312 L96.538,356.312",
    "1p8": "M723.688,96.538 L410.113,410.113 A183.688,183.688 0 1,0 669.887,410.113 L356.312,96.538",

    // ========== Cup-shape Curve (CCW, larger) ==========
    "1pp1": "M723.688,96.538 L560.735,446.377 A221.731,221.731 0 1,0 943.845,413.512 L723.688,96.538",
    "1pp2": "M723.688,96.538 L560.735,446.377 A221.731,221.731 0 1,0 983.462,540.000 L983.462,356.312",
    "1pp3": "M723.688,96.538 L560.735,446.377 A221.731,221.731 0 0,0 802.981,757.860 L983.462,723.688",
    "1pp4": "M723.688,96.538 L560.735,446.377 A221.731,221.731 0 1,0 983.462,540.000 A221.731,221.731 0 1,0 560.735,633.623 L723.688,983.462",
    "1pp5": "M723.688,96.538 L560.735,446.377 A221.731,221.731 0 1,0 983.462,540.000 A221.731,221.731 0 0,0 554.421,461.340 L356.312,983.462",
    "1pp6": "M723.688,96.538 L560.735,446.377 A221.731,221.731 0 1,0 637.167,356.565 L96.538,723.688",
    "1pp7": "M723.688,96.538 L560.735,446.377 A221.731,221.731 0 1,0 748.948,318.638 L96.538,356.312",
    "1pp8": "M723.688,96.538 L560.735,446.377 A221.731,221.731 0 1,0 858.620,340.558 L356.312,96.538",

    // ========== Wifi (center lane) ==========
    "1w5": "M723.688,96.538 L356.312,983.462",
    // Wifi side lanes (for drawing the three-lane effect)
    "1Wi4": "M723.688,96.538 L723.688,983.462",
    "1Wi6": "M723.688,96.538 L96.538,723.688",
};

/**
 * Registry of all resolved slides.
 * Key: shape string like "3-5", "1<3", "2w6"
 * Value: { svgPath, isReflect, rotate }
 */
const SLIDE_REGISTRY = {};

/**
 * Get the ending pad number: ((start + dist) % 8) or 8, giving values 1–8.
 */
function getEndPad(start, dist) {
    return ((start + dist) % 8) || 8;
}

/**
 * Pre-generate all slide entries, mirroring Python's SlideInfo.generate_all().
 */
function generateAllSlides() {
    for (let start = 1; start <= 8; start++) {
        const rotate = start - 1;

        // Straight slides (dist = 2..6)
        for (const dist of [2, 3, 4, 5, 6]) {
            const end = getEndPad(start, dist);
            const key = `${start}-${end}`;
            const baseKey = `1-${dist + 1}`;
            SLIDE_REGISTRY[key] = { svgPath: BASE_SLIDE_SVG[baseKey], isReflect: false, rotate };
        }

        // Circle arcs, p-curves, pp-curves
        for (let dist = 0; dist < 8; dist++) {
            const endCCW = getEndPad(start, dist);
            const endCW = (((start - dist) % 8) + 8) % 8 || 8;

            const baseCircle = `1<${dist + 1}`;
            const baseP = `1p${dist + 1}`;
            const basePP = `1pp${dist + 1}`;

            // CCW: if start in {1,2,7,8} use "<", else ">"
            const ccwChar = [1, 2, 7, 8].includes(start) ? '<' : '>';
            const cwChar = [1, 2, 7, 8].includes(start) ? '>' : '<';

            SLIDE_REGISTRY[`${start}${ccwChar}${endCCW}`] = { svgPath: BASE_SLIDE_SVG[baseCircle], isReflect: false, rotate };
            SLIDE_REGISTRY[`${start}${cwChar}${endCW}`]  = { svgPath: BASE_SLIDE_SVG[baseCircle], isReflect: true,  rotate };

            // ^ alias (large arc, 5–7 dist)
            if (dist >= 5 && dist <= 7) {
                SLIDE_REGISTRY[`${start}^${endCCW}`] = SLIDE_REGISTRY[`${start}${ccwChar}${endCCW}`];
                SLIDE_REGISTRY[`${start}^${endCW}`]  = SLIDE_REGISTRY[`${start}${cwChar}${endCW}`];
            }

            // p/q curves
            SLIDE_REGISTRY[`${start}p${endCCW}`] = { svgPath: BASE_SLIDE_SVG[baseP], isReflect: false, rotate };
            SLIDE_REGISTRY[`${start}q${endCW}`]  = { svgPath: BASE_SLIDE_SVG[baseP], isReflect: true,  rotate };

            // pp/qq big curves
            SLIDE_REGISTRY[`${start}pp${endCCW}`] = { svgPath: BASE_SLIDE_SVG[basePP], isReflect: false, rotate };
            SLIDE_REGISTRY[`${start}qq${endCW}`]  = { svgPath: BASE_SLIDE_SVG[basePP], isReflect: true,  rotate };
        }

        // V-shape (dist = 1,2,3,5,6,7)
        for (const dist of [1, 2, 3, 5, 6, 7]) {
            const end = getEndPad(start, dist);
            const key = `${start}v${end}`;
            const baseKey = `1v${dist + 1}`;
            SLIDE_REGISTRY[key] = { svgPath: BASE_SLIDE_SVG[baseKey], isReflect: false, rotate };
        }

        // Lightning s / z
        const endLightning = getEndPad(start, 4);
        SLIDE_REGISTRY[`${start}s${endLightning}`] = { svgPath: BASE_SLIDE_SVG["1s5"], isReflect: false, rotate };
        SLIDE_REGISTRY[`${start}z${endLightning}`] = { svgPath: BASE_SLIDE_SVG["1s5"], isReflect: true,  rotate };

        // L-shape (Grand V)
        for (const distEnd of [1, 2, 3, 4]) {
            const endCCW = getEndPad(start, distEnd);
            const midCCW = (((start - 2) % 8) + 8) % 8 || 8;
            const keyCCW = `${start}V${midCCW}${endCCW}`;
            SLIDE_REGISTRY[keyCCW] = { svgPath: BASE_SLIDE_SVG[`1V7${distEnd + 1}`], isReflect: false, rotate };

            const endCW = (((start - distEnd) % 8) + 8) % 8 || 8;
            const midCW = getEndPad(start, 2);
            const keyCW = `${start}V${midCW}${endCW}`;
            SLIDE_REGISTRY[keyCW] = { svgPath: BASE_SLIDE_SVG[`1V7${distEnd + 1}`], isReflect: true,  rotate };
        }

        // Wifi
        const endWifi = getEndPad(start, 4);
        SLIDE_REGISTRY[`${start}w${endWifi}`] = {
            isWifi: true,
            svgMid: BASE_SLIDE_SVG["1w5"],
            svgLeft: BASE_SLIDE_SVG["1Wi6"],
            svgRight: BASE_SLIDE_SVG["1Wi4"],
            isReflect: false,
            rotate
        };
    }
}

// Call at startup
generateAllSlides();

/** Look up slide registry entry for a given shape key. Returns null if not found. */
function getSlideInfo(shapeKey) {
    return SLIDE_REGISTRY[shapeKey] || null;
}
