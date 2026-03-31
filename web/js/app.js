/**
 * app.js
 * Main application logic: file loading, chart management, animation loop.
 */

// ==================== State ====================
const App = {
    canvas: null,
    ctx: null,
    notes: [],          // full sorted list
    notePointer: 0,     // next note to consider for active list
    activeNotes: [],    // notes currently rendered

    timerTicks: 0,      // current time in ticks
    startTimeMs: 0,     // real clock time when animation started
    pausedAtMs: 0,      // real clock time when paused
    elapsedBeforePause: 0, // accumulated ticks before current pause start
    playing: false,
    rafId: null,

    maidataInfo: null,  // parsed maidata info
    selectedDiff: null,
};

// ==================== UI Elements ====================
let ui = {};

function initUI() {
    ui.canvas    = document.getElementById('gameCanvas');
    ui.fileInput = document.getElementById('fileInput');
    ui.fileBtn   = document.getElementById('fileBtn');
    ui.pasteArea = document.getElementById('pasteArea');
    ui.pasteBtn  = document.getElementById('pasteBtn');
    ui.diffSel   = document.getElementById('diffSelect');
    ui.loadBtn   = document.getElementById('loadBtn');
    ui.playBtn   = document.getElementById('playBtn');
    ui.resetBtn  = document.getElementById('resetBtn');
    ui.statusEl  = document.getElementById('status');
    ui.timerEl   = document.getElementById('timer');
    ui.infoEl    = document.getElementById('info');
    ui.noteCountEl = document.getElementById('noteCount');

    App.canvas = ui.canvas;
    App.ctx = ui.canvas.getContext('2d');

    // Draw initial background
    drawBackground(App.ctx);

    // Events
    ui.fileBtn.addEventListener('click', () => ui.fileInput.click());
    ui.fileInput.addEventListener('change', handleFileChange);
    ui.pasteBtn.addEventListener('click', handlePaste);
    ui.loadBtn.addEventListener('click', handleLoad);
    ui.playBtn.addEventListener('click', togglePlay);
    ui.resetBtn.addEventListener('click', handleReset);
}

// ==================== File Loading ====================

function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        loadMaidataText(ev.target.result, file.name);
    };
    reader.readAsText(file, 'utf-8');
}

function handlePaste() {
    const text = ui.pasteArea.value.trim();
    if (!text) {
        setStatus('请先在文本框中粘贴 maidata.txt 内容', 'error');
        return;
    }
    loadMaidataText(text, '粘贴内容');
}

function loadMaidataText(text, name) {
    try {
        const info = parseMaidata(text);
        App.maidataInfo = info;

        const diffs = Object.keys(info.difficulties).sort();
        if (diffs.length === 0) {
            setStatus(`"${name}" 中未找到谱面数据`, 'error');
            return;
        }

        // Populate difficulty selector
        ui.diffSel.innerHTML = '';
        const diffNames = { '1': 'Easy', '2': 'Basic', '3': 'Advanced', '4': 'Expert', '5': 'Master', '6': 'Re:Master', '7': 'Utage' };
        for (const d of diffs) {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = `${diffNames[d] || d} (${d})`;
            ui.diffSel.appendChild(opt);
        }
        // Default to highest difficulty
        ui.diffSel.value = diffs[diffs.length - 1];

        setStatus(`已加载: "${info.title || name}"  可用难度: ${diffs.join(', ')}`, 'ok');

        const titleInfo = [
            info.title ? `标题: ${info.title}` : '',
            info.artist ? `作者: ${info.artist}` : '',
        ].filter(Boolean).join('  |  ');
        ui.infoEl.textContent = titleInfo;

        // Auto-load first difficulty
        handleLoad();
    } catch (e) {
        setStatus('解析失败: ' + e.message, 'error');
        console.error(e);
    }
}

// ==================== Chart Loading ====================

function handleLoad() {
    if (!App.maidataInfo) {
        setStatus('请先加载 maidata.txt 文件', 'error');
        return;
    }

    const diff = ui.diffSel.value;
    if (!diff || !App.maidataInfo.difficulties[diff]) {
        setStatus('未找到所选难度', 'error');
        return;
    }

    stopAnimation();

    try {
        const chartStr = App.maidataInfo.difficulties[diff];
        const first = App.maidataInfo.first || 0;
        const notes = SimaiParser.parseChart(chartStr, first);

        App.notes = notes;
        App.notePointer = 0;
        App.activeNotes = [];
        App.timerTicks = -JUDGE_TPS * 3; // start 3 seconds before chart
        App.elapsedBeforePause = App.timerTicks;

        ui.noteCountEl.textContent = `共 ${notes.length} 个 Note`;
        setStatus(`已加载难度 ${diff}，共 ${notes.length} 个 Note。点击 "播放" 开始。`, 'ok');
        App.selectedDiff = diff;

        // Draw first frame
        renderCurrentFrame();
    } catch (e) {
        setStatus('谱面解析失败: ' + e.message, 'error');
        console.error(e);
    }
}

// ==================== Animation ====================

function togglePlay() {
    if (App.playing) {
        pauseAnimation();
        ui.playBtn.textContent = '▶ 播放';
    } else {
        startAnimation();
        ui.playBtn.textContent = '⏸ 暂停';
    }
}

function startAnimation() {
    if (App.notes.length === 0) {
        setStatus('请先加载谱面', 'error');
        return;
    }
    App.playing = true;
    App.startTimeMs = performance.now();
    // elapsedBeforePause holds accumulated ticks so far
    animationLoop();
}

function pauseAnimation() {
    App.playing = false;
    if (App.rafId) {
        cancelAnimationFrame(App.rafId);
        App.rafId = null;
    }
    // Save current position
    App.elapsedBeforePause = App.timerTicks;
}

function stopAnimation() {
    pauseAnimation();
    App.playing = false;
    ui.playBtn.textContent = '▶ 播放';
}

function handleReset() {
    stopAnimation();
    App.timerTicks = -JUDGE_TPS * 3;
    App.elapsedBeforePause = App.timerTicks;
    App.notePointer = 0;
    App.activeNotes = [];
    renderCurrentFrame();
    setStatus('已重置', 'ok');
    ui.timerEl.textContent = formatTime(App.timerTicks);
}

function animationLoop() {
    if (!App.playing) return;

    const realElapsedMs = performance.now() - App.startTimeMs;
    App.timerTicks = App.elapsedBeforePause + realElapsedMs * JUDGE_TPS / 1000;

    renderCurrentFrame();

    // Update timer display
    ui.timerEl.textContent = formatTime(App.timerTicks);

    // Check if chart ended
    if (App.notes.length > 0) {
        const lastNote = App.notes[App.notes.length - 1];
        const chartEnd = (lastNote.endMoment || lastNote.moment) + JUDGE_TPS * 3;
        if (App.timerTicks > chartEnd) {
            pauseAnimation();
            ui.playBtn.textContent = '▶ 播放';
            setStatus('谱面播放完毕', 'ok');
            return;
        }
    }

    App.rafId = requestAnimationFrame(animationLoop);
}

function renderCurrentFrame() {
    const now = App.timerTicks;
    const ctx = App.ctx;

    // Update active notes
    updateActiveNotes(now);

    // Render
    renderFrame(ctx, App.activeNotes, now);

    // Overlay timer
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(5, 5, 160, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(formatTime(now), 10, 8);
}

function updateActiveNotes(now) {
    // Advance pointer: add notes that are becoming active
    // Sort by moment: we can scan forward
    while (App.notePointer < App.notes.length) {
        const note = App.notes[App.notePointer];
        const appearTime = (note.type === NoteType.SLIDE || note.type === NoteType.WIFI)
            ? note.availableMoment - APPEAR_LEAD
            : note.moment - APPEAR_LEAD;

        if (now < appearTime) break;
        App.activeNotes.push(note);
        App.notePointer++;
    }

    // Remove expired notes
    App.activeNotes = App.activeNotes.filter(n => isNoteActive(n, now));
}

// ==================== Utilities ====================

function formatTime(ticks) {
    const seconds = ticks / JUDGE_TPS;
    const sign = seconds < 0 ? '-' : '';
    const absS = Math.abs(seconds);
    const m = Math.floor(absS / 60);
    const s = absS % 60;
    return `${sign}${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

function setStatus(msg, type) {
    ui.statusEl.textContent = msg;
    ui.statusEl.className = 'status ' + (type || '');
}

// ==================== Entry Point ====================
window.addEventListener('DOMContentLoaded', initUI);
