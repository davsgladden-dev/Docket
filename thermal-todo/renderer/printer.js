// ═══════════════════════════════════════════════════════════
// THERMAL TODO — PRINTER RENDERER
// Handles the printer UI: controls, item entry, print flow.
// Receipt display and tear interaction live in paper.js.
// ═══════════════════════════════════════════════════════════

const COLORS = [
    '#FFF9C4', '#C8F5E0', '#FFD6D6', '#D6EDFF',
    '#E8D6FF', '#FFE5CC', '#F5F2EE', '#D8EDD8',
];

const MAX_ITEMS = 15;

// ── State ────────────────────────────────────────────────
let printerState = 'idle';
let selectedColor = COLORS[0];
let currentTicketData = null;

// ── Color Selector ───────────────────────────────────────
function initColorSelector() {
    const container = document.getElementById('color-selector');
    COLORS.forEach((color, i) => {
        const swatch = document.createElement('div');
        swatch.className = `color-swatch${i === 0 ? ' selected' : ''}`;
        swatch.style.backgroundColor = color;
        swatch.addEventListener('click', () => {
            selectedColor = color;
            container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
            document.getElementById('paper-peek').style.backgroundColor = color;
        });
        container.appendChild(swatch);
    });
}

// ── Item Management ──────────────────────────────────────
function createItemRow(value = '') {
    const row = document.createElement('div');
    row.className = 'item-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'thermal-input item-input';
    input.placeholder = 'Add item...';
    input.maxLength = 50;
    input.value = value;

    const btn = document.createElement('button');
    btn.className = 'remove-item-btn';
    btn.textContent = '✕';
    btn.addEventListener('click', () => {
        const container = document.getElementById('items-container');
        if (container.children.length > 1) {
            row.remove();
            updateAddButton();
        } else {
            input.value = '';
            input.focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addItemRow(); }
    });

    row.append(input, btn);
    return row;
}

function addItemRow() {
    const container = document.getElementById('items-container');
    if (container.children.length >= MAX_ITEMS) return;
    const row = createItemRow();
    container.appendChild(row);
    row.querySelector('input').focus();
    container.scrollTop = container.scrollHeight;
    updateAddButton();
}

function updateAddButton() {
    const container = document.getElementById('items-container');
    const btn = document.getElementById('add-item-btn');
    btn.classList.toggle('hidden', container.children.length >= MAX_ITEMS);
}

function getItemTexts() {
    return Array.from(document.querySelectorAll('.item-input'))
        .map(inp => inp.value.trim())
        .filter(Boolean);
}

// ── Status Display ───────────────────────────────────────
function updateStatus(state) {
    const dot  = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const display = document.getElementById('status-display');

    display.classList.remove('printing');

    switch (state) {
        case 'idle':
            text.textContent = 'READY';
            dot.style.background  = 'var(--status-green)';
            dot.style.boxShadow   = '0 0 4px var(--status-glow)';
            text.style.color      = 'var(--status-green)';
            break;
        case 'printing':
            text.textContent = 'PRINTING';
            dot.style.background  = '#f0b840';
            dot.style.boxShadow   = '0 0 4px rgba(240,184,64,0.5)';
            text.style.color      = '#f0b840';
            display.classList.add('printing');
            break;
        case 'ready':
            text.textContent = 'TEAR ↑';
            dot.style.background  = '#50a0f0';
            dot.style.boxShadow   = '0 0 4px rgba(80,160,240,0.5)';
            text.style.color      = '#50a0f0';
            break;
    }
}

// ── Paper Peek ───────────────────────────────────────────
function showPaperPeek() {
    document.getElementById('paper-peek').classList.add('visible');
}
function hidePaperPeek() {
    document.getElementById('paper-peek').classList.remove('visible');
}

// ── Print Flow ───────────────────────────────────────────
async function handlePrint() {
    if (printerState !== 'idle') return;

    const texts = getItemTexts();
    if (texts.length === 0) {
        const c = document.getElementById('items-container');
        c.classList.add('shake');
        setTimeout(() => c.classList.remove('shake'), 400);
        c.querySelector('.item-input')?.focus();
        return;
    }

    currentTicketData = {
        title: document.getElementById('ticket-title').value.trim(),
        items: texts.map(t => ({ text: t, done: false })),
        color: selectedColor,
    };

    printerState = 'printing';
    setFormEnabled(false);
    updateStatus('printing');
    showPaperPeek();

    window.thermalAPI.printStart(currentTicketData);
    await playPrinterAnimation();
}

// ── Printer Body Animation ───────────────────────────────
// Jitter, LED flash, and button press — runs while paper emerges in the paper window.
function playPrinterAnimation() {
    return new Promise(resolve => {
        const printer  = document.getElementById('printer');
        const led      = document.getElementById('led');
        const brandLed = document.getElementById('brand-led');
        const printBtn = document.getElementById('print-btn');

        const tl = gsap.timeline({ onComplete: resolve });

        tl.to(printBtn, {
            y: 3, duration: 0.12, ease: 'power2.in',
        }, 0);

        tl.to(printer, {
            x: 0.6, duration: 0.035,
            repeat: 50, yoyo: true, ease: 'none',
        }, 0.15);

        tl.to([led, brandLed], {
            backgroundColor: '#f0b840',
            boxShadow: '0 0 8px rgba(240,184,64,0.6)',
            duration: 0.12, repeat: 17, yoyo: true, ease: 'none',
        }, 0.15);

        tl.to(printBtn, {
            y: 0, duration: 0.25, ease: 'power2.out',
        }, '-=0.4');

        tl.to([led, brandLed], {
            backgroundColor: 'var(--led-color)',
            boxShadow: '0 0 5px var(--led-glow)',
            duration: 0.3,
        }, '-=0.3');
    });
}

// ── Reset ────────────────────────────────────────────────
function resetPrinter() {
    hidePaperPeek();
    setFormEnabled(true);
    updateStatus('idle');
    resetForm();
    printerState = 'idle';
    currentTicketData = null;
}

function resetForm() {
    document.getElementById('ticket-title').value = '';
    const c = document.getElementById('items-container');
    c.innerHTML = '';
    c.appendChild(createItemRow());
    updateAddButton();
}

// ── Helpers ──────────────────────────────────────────────
function setFormEnabled(enabled) {
    document.getElementById('control-panel').classList.toggle('disabled', !enabled);
    document.getElementById('print-btn').disabled = !enabled;
}

// ── Title Bar ────────────────────────────────────────────
function initTitleBar() {
    document.getElementById('btn-minimize').addEventListener('click',
        () => window.thermalAPI.minimizeWindow());
    document.getElementById('btn-close').addEventListener('click',
        () => window.thermalAPI.closeWindow());
}

// ── Keyboard Shortcuts ───────────────────────────────────
function initKeyboard() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handlePrint();
        }
        if (e.key === 'Escape' && printerState === 'printing') {
            window.thermalAPI.cancelPrint();
        }
    });
}

// ── Theme Toggle ─────────────────────────────────────────
function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle-input');
    const html = document.documentElement;

    const saved = localStorage.getItem('thermal-theme');
    if (saved === 'pixel') {
        html.setAttribute('data-theme', 'pixel');
        toggle.checked = true;
    }

    toggle.addEventListener('change', () => {
        const isPixel = toggle.checked;
        html.setAttribute('data-theme', isPixel ? 'pixel' : 'retro');
        localStorage.setItem('thermal-theme', isPixel ? 'pixel' : 'retro');
    });
}

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTitleBar();
    initColorSelector();
    initKeyboard();
    initThemeToggle();

    const c = document.getElementById('items-container');
    c.appendChild(createItemRow());

    document.getElementById('add-item-btn').addEventListener('click', addItemRow);
    document.getElementById('print-btn').addEventListener('click', handlePrint);

    document.getElementById('paper-peek').style.backgroundColor = selectedColor;

    // Main process signals
    window.thermalAPI.onReset(resetPrinter);
    window.thermalAPI.onPaperReady(() => {
        if (printerState === 'printing') updateStatus('ready');
    });
});
