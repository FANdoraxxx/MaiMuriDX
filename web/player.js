/**
 * player.js — MaiMuriDX Embeddable Player API
 *
 * Exposes a `createMaiPlayer(canvasId, options)` factory that returns a
 * `MaiPlayer` instance.  The host page is responsible for all UI controls;
 * this module only handles rendering and playback.
 *
 * Dependencies (must be loaded before this file):
 *   js/core.js · js/slide_data.js · js/parser.js · js/renderer.js
 *
 * Quick start:
 *   const player = await createMaiPlayer('unity-canvas', { showTimer: true });
 *   await player.loadChart(maidataText, '5');
 *   player.play();
 *
 * MaiCreator-compatible SendMessage interface:
 *   player.SendMessage('Player', 'LoadChart',   JSON.stringify({ text, difficulty }));
 *   player.SendMessage('Player', 'Play',         '');
 *   player.SendMessage('Player', 'Pause',        '');
 *   player.SendMessage('Player', 'Reset',        '');
 *   player.SendMessage('Player', 'SeekTo',       '30.5');        // seconds
 *   player.SendMessage('Player', 'SetDifficulty','5');
 *   player.SendMessage('Player', 'SetSkin',       JSON.stringify({ tap: '/img/tap.png' }));
 *
 * Events (dispatched on the player instance which extends EventTarget):
 *   'ready'       — player initialised, canvas drawn
 *   'chartloaded' — e.detail: { title, artist, difficulties, noteCount, durationTicks }
 *   'play'        — playback started / resumed
 *   'pause'       — playback paused
 *   'ended'       — chart reached its end
 *   'timeupdate'  — e.detail: { ticks, seconds } (fired every animation frame)
 *   'error'       — e.detail: { message }
 */

// ==================== Factory ====================

/**
 * Create and initialise a MaiPlayer instance.
 *
 * @param {string|HTMLCanvasElement} canvasIdOrElement
 *   Either the id of an existing <canvas> element or the element itself.
 * @param {Object} [options]
 * @param {boolean} [options.showTimer=false]   Overlay a time readout on the canvas.
 * @param {Object}  [options.skin]              Skin config (see applySkin / setSkin).
 * @returns {Promise<MaiPlayer>}
 */
async function createMaiPlayer(canvasIdOrElement, options = {}) {
    const canvas = typeof canvasIdOrElement === 'string'
        ? document.getElementById(canvasIdOrElement)
        : canvasIdOrElement;

    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error(`[MaiPlayer] Canvas not found: ${canvasIdOrElement}`);
    }

    const player = new MaiPlayer(canvas, options);

    // Apply initial skin if provided
    if (options.skin) {
        await player.setSkin(options.skin);
    }

    return player;
}

// ==================== MaiPlayer class ====================

class MaiPlayer extends EventTarget {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Object} options
     */
    constructor(canvas, options = {}) {
        super();

        /** @type {HTMLCanvasElement} */ this._canvas  = canvas;
        /** @type {CanvasRenderingContext2D} */ this._ctx = canvas.getContext('2d');

        // Playback state
        this._notes           = [];
        this._notePointer     = 0;
        this._activeNotes     = [];
        this._timerTicks      = 0;
        this._startTimeMs     = 0;
        this._elapsedBeforePause = 0;
        this._playing         = false;
        this._rafId           = null;

        // Chart metadata
        this._maidataInfo     = null;
        this._selectedDiff    = null;

        // Options
        this._showTimer       = !!options.showTimer;

        // Draw initial board
        drawBackground(this._ctx);
        this._emit('ready');
    }

    // ==================== Read-only properties ====================

    /** Current playback position in ticks (180 ticks = 1 second). */
    get currentTicks()   { return this._timerTicks; }

    /** Current playback position in seconds. */
    get currentSeconds() { return this._timerTicks / JUDGE_TPS; }

    /** Whether playback is currently active. */
    get isPlaying()      { return this._playing; }

    /** Total number of notes in the loaded chart. */
    get noteCount()      { return this._notes.length; }

    /**
     * Chart duration in ticks (moment of last note + a short tail).
     * Returns 0 if no chart is loaded.
     */
    get durationTicks() {
        if (!this._notes.length) return 0;
        const last = this._notes[this._notes.length - 1];
        return (last.endMoment || last.moment) + JUDGE_TPS * 3;
    }

    /** Chart duration in seconds. */
    get durationSeconds() { return this.durationTicks / JUDGE_TPS; }

    // ==================== Chart loading ====================

    /**
     * Parse and load a maidata chart.
     *
     * @param {string} maidataText   Full contents of maidata.txt (or just the chart portion).
     * @param {string|number} [difficulty]
     *   Difficulty slot to load: '1'–'7' (or corresponding numbers).
     *   If omitted, the highest available difficulty is used.
     * @returns {Promise<void>}  Resolves when the chart is parsed and the first frame drawn.
     */
    async loadChart(maidataText, difficulty) {
        this._stop();

        let info;
        try {
            info = parseMaidata(maidataText);
        } catch (e) {
            this._emit('error', { message: 'Parse error: ' + e.message });
            throw e;
        }

        this._maidataInfo = info;

        const diffs = Object.keys(info.difficulties).sort();
        if (diffs.length === 0) {
            const msg = 'No chart data found in the provided text.';
            this._emit('error', { message: msg });
            throw new Error(msg);
        }

        // Resolve difficulty slot
        const diffStr = difficulty !== undefined ? String(difficulty) : diffs[diffs.length - 1];
        if (!info.difficulties[diffStr]) {
            const msg = `Difficulty '${diffStr}' not found. Available: ${diffs.join(', ')}`;
            this._emit('error', { message: msg });
            throw new Error(msg);
        }

        this._selectedDiff = diffStr;
        return this._loadDifficulty(diffStr);
    }

    /**
     * Switch to a different difficulty of the currently-loaded maidata.
     * Requires loadChart() to have been called first.
     *
     * @param {string|number} difficulty
     * @returns {Promise<void>}
     */
    async setDifficulty(difficulty) {
        if (!this._maidataInfo) {
            throw new Error('[MaiPlayer] No chart loaded. Call loadChart() first.');
        }
        const diffStr = String(difficulty);
        if (!this._maidataInfo.difficulties[diffStr]) {
            throw new Error(`[MaiPlayer] Difficulty '${diffStr}' not found.`);
        }
        this._stop();
        this._selectedDiff = diffStr;
        return this._loadDifficulty(diffStr);
    }

    /** @private */
    _loadDifficulty(diffStr) {
        const info = this._maidataInfo;
        let notes;
        try {
            notes = SimaiParser.parseChart(info.difficulties[diffStr], info.first || 0);
        } catch (e) {
            this._emit('error', { message: 'Chart parse error: ' + e.message });
            throw e;
        }

        this._notes           = notes;
        this._notePointer     = 0;
        this._activeNotes     = [];
        this._timerTicks      = -JUDGE_TPS * 3;   // start 3 s before first note
        this._elapsedBeforePause = this._timerTicks;

        this._emit('chartloaded', {
            title:        info.title  || '',
            artist:       info.artist || '',
            difficulties: Object.keys(info.difficulties).sort(),
            noteCount:    notes.length,
            durationTicks: this.durationTicks,
        });

        this._renderFrame();
        return Promise.resolve();
    }

    // ==================== Playback controls ====================

    /** Start or resume playback. */
    play() {
        if (this._notes.length === 0) {
            this._emit('error', { message: 'No chart loaded.' });
            return;
        }
        if (this._playing) return;

        this._playing     = true;
        this._startTimeMs = performance.now();
        this._loop();
        this._emit('play');
    }

    /** Pause playback (preserves current position). */
    pause() {
        if (!this._playing) return;
        this._playing = false;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._elapsedBeforePause = this._timerTicks;
        this._emit('pause');
    }

    /** Stop playback and rewind to the beginning. */
    reset() {
        this._stop();
        this._timerTicks         = -JUDGE_TPS * 3;
        this._elapsedBeforePause = this._timerTicks;
        this._notePointer        = 0;
        this._activeNotes        = [];
        this._renderFrame();
        this._emit('reset');
    }

    /**
     * Seek to an absolute position.
     * @param {number} ticks - absolute position in ticks
     */
    seekToTicks(ticks) {
        const wasPlaying = this._playing;
        if (wasPlaying) {
            this._playing = false;
            if (this._rafId) {
                cancelAnimationFrame(this._rafId);
                this._rafId = null;
            }
        }

        this._timerTicks         = ticks;
        this._elapsedBeforePause = ticks;
        // Reset note list so _updateActiveNotes() (called inside _renderFrame) rebuilds
        // the active set from scratch at the new position.
        this._notePointer = 0;
        this._activeNotes = [];
        this._renderFrame();

        if (wasPlaying) {
            this._playing     = true;
            this._startTimeMs = performance.now();
            this._loop();
        }
    }

    /**
     * Seek to an absolute position in seconds.
     * @param {number} seconds
     */
    seekToSeconds(seconds) {
        this.seekToTicks(seconds * JUDGE_TPS);
    }

    // ==================== Skin ====================

    /**
     * Apply a skin configuration.
     *
     * Each value can be an HTMLImageElement, ImageBitmap, or a URL string.
     * Returns a Promise that resolves once all images have loaded.
     *
     * Supported keys:
     *   tap, tapEach, tapBreak, tapStar,
     *   hold, holdTrail,
     *   touch, touchHold,
     *   slideStar, wifiStar
     *
     * @param {Object} skinConfig
     * @returns {Promise<void>}
     */
    setSkin(skinConfig) {
        return applySkin(skinConfig);
    }

    // ==================== MaiCreator SendMessage API ====================

    /**
     * MaiCreator-compatible interface. The host page can control the player
     * using the same messaging convention as Unity WebGL.
     *
     * Supported messages (objectName is ignored; use any string such as 'Player'):
     *
     *   method          value
     *   LoadChart       JSON: { text: string, difficulty?: string }
     *                   or   plain maidata text string
     *   Play            ''
     *   Pause           ''
     *   Reset           ''
     *   SeekTo          seconds as a numeric string  e.g. '30.5'
     *   SeekToTicks     ticks as a numeric string    e.g. '5400'
     *   SetDifficulty   difficulty slot string        e.g. '5'
     *   SetSkin         JSON: skin config object (same keys as setSkin)
     *
     * @param {string} _objectName  (ignored – present for API compatibility)
     * @param {string} method
     * @param {string} value
     * @returns {MaiPlayer} this (for chaining)
     */
    SendMessage(_objectName, method, value) {
        switch (method) {
            case 'LoadChart': {
                let text = value, diff;
                try {
                    const parsed = JSON.parse(value);
                    text = parsed.text;
                    diff = parsed.difficulty;
                } catch (_) {
                    // value is plain maidata text
                }
                this.loadChart(text, diff).catch(e => this._emit('error', { message: e.message }));
                break;
            }
            case 'Play':
                this.play();
                break;
            case 'Pause':
                this.pause();
                break;
            case 'Reset':
                this.reset();
                break;
            case 'SeekTo':
                this.seekToSeconds(parseFloat(value));
                break;
            case 'SeekToTicks':
                this.seekToTicks(parseFloat(value));
                break;
            case 'SetDifficulty':
                this.setDifficulty(value).catch(e => this._emit('error', { message: e.message }));
                break;
            case 'SetSkin': {
                let cfg = {};
                try { cfg = JSON.parse(value); } catch (_) {}
                this.setSkin(cfg).catch(e => this._emit('error', { message: e.message }));
                break;
            }
            default:
                console.warn(`[MaiPlayer] Unknown SendMessage method: ${method}`);
        }
        return this;
    }

    // ==================== Private helpers ====================

    /** @private Internal stop (no event emitted) */
    _stop() {
        this._playing = false;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._elapsedBeforePause = this._timerTicks;
    }

    /** @private Animation loop */
    _loop() {
        if (!this._playing) return;

        const realElapsedMs = performance.now() - this._startTimeMs;
        this._timerTicks = this._elapsedBeforePause + realElapsedMs * JUDGE_TPS / 1000;

        this._renderFrame();

        // Check end of chart
        if (this._notes.length > 0 && this._timerTicks > this.durationTicks) {
            this._stop();
            this._emit('ended');
            return;
        }

        this._emit('timeupdate', { ticks: this._timerTicks, seconds: this.currentSeconds });
        this._rafId = requestAnimationFrame(() => this._loop());
    }

    /** @private Render one frame */
    _renderFrame() {
        const now = this._timerTicks;
        const ctx = this._ctx;

        _updateActiveNotes(this, now);
        renderFrame(ctx, this._activeNotes, now);

        if (this._showTimer) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(5, 5, 160, 22);
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(_formatTicks(now), 10, 8);
        }
    }

    /** @private Typed event helper */
    _emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail: detail || null }));
    }
}

// ==================== Module-level helpers ====================

/** @private Update the active-note list for a given player state */
function _updateActiveNotes(player, now) {
    while (player._notePointer < player._notes.length) {
        const note = player._notes[player._notePointer];
        const appearTime = (note.type === NoteType.SLIDE || note.type === NoteType.WIFI)
            ? note.availableMoment - APPEAR_LEAD
            : note.moment - APPEAR_LEAD;
        if (now < appearTime) break;
        player._activeNotes.push(note);
        player._notePointer++;
    }
    player._activeNotes = player._activeNotes.filter(n => isNoteActive(n, now));
}

/** @private Format ticks as mm:ss.cc */
function _formatTicks(ticks) {
    const seconds = ticks / JUDGE_TPS;
    const sign  = seconds < 0 ? '-' : '';
    const absS  = Math.abs(seconds);
    const m     = Math.floor(absS / 60);
    const s     = absS % 60;
    return `${sign}${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

// Expose factory globally so host pages can call window.createMaiPlayer(...)
window.createMaiPlayer = createMaiPlayer;
