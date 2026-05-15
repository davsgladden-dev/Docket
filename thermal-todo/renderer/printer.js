// ═══════════════════════════════════════════════════════════
// THERMAL TODO — PRINTER RENDERER (Final Polish)
// ═══════════════════════════════════════════════════════════

const COLORS = [
    '#FFF9C4', '#C8F5E0', '#FFD6D6', '#D6EDFF',
    '#E8D6FF', '#FFE5CC', '#F5F2EE', '#D8EDD8',
];

// ── Interlocking torn edge ───────────────────────────────
// These depth values match ticket.css torn-edge EXACTLY.
// Receipt gets depths as-is, ticket gets (12 - depth).
// Together they interlock like two halves of one tear.
const TORN_BOTTOM = `polygon(
  0% 0%, 100% 0%,
  100% calc(100% - 7px),
  95% calc(100% - 3px),
  90% calc(100% - 8px),
  85% calc(100% - 5px),
  80% calc(100% - 10px),
  75% calc(100% - 4px),
  70% calc(100% - 9px),
  65% calc(100% - 7px),
  60% calc(100% - 2px),
  55% calc(100% - 11px),
  50% calc(100% - 3px),
  45% calc(100% - 6px),
  40% calc(100% - 10px),
  35% calc(100% - 4px),
  30% calc(100% - 8px),
  25% calc(100% - 2px),
  20% calc(100% - 11px),
  15% calc(100% - 5px),
  10% calc(100% - 9px),
  5% calc(100% - 3px),
  0% calc(100% - 7px)
)`;

const MAX_ITEMS = 15;

// ── State ────────────────────────────────────────────────
let printerState = 'idle';
let selectedColor = COLORS[0];
let currentTicketData = null;
let breatheTween = null;

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
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const display = document.getElementById('status-display');

    display.classList.remove('printing');

    switch (state) {
        case 'idle':
            text.textContent = 'READY';
            dot.style.background = '#50d890';
            dot.style.boxShadow = '0 0 4px rgba(80,216,144,0.5)';
            text.style.color = '#50d890';
            break;
        case 'printing':
            text.textContent = 'PRINTING';
            dot.style.background = '#f0b840';
            dot.style.boxShadow = '0 0 4px rgba(240,184,64,0.5)';
            text.style.color = '#f0b840';
            display.classList.add('printing');
            break;
        case 'ready':
            text.textContent = 'TEAR ↑';
            dot.style.background = '#50a0f0';
            dot.style.boxShadow = '0 0 4px rgba(80,160,240,0.5)';
            text.style.color = '#50a0f0';
            break;
    }
}

// ── Receipt Preview Builder ──────────────────────────────
function buildReceiptPreview(data) {
    const preview = document.getElementById('receipt-preview');
    preview.style.backgroundColor = data.color;
    preview.innerHTML = '';

    if (data.title) {
        const title = document.createElement('div');
        title.className = 'rp-title';
        title.textContent = data.title;
        preview.appendChild(title);
    }

    preview.appendChild(makeSep());

    data.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'rp-item';
        const cb = document.createElement('div');
        cb.className = 'rp-checkbox';
        const txt = document.createElement('span');
        txt.className = 'rp-item-text';
        txt.textContent = item.text;
        row.append(cb, txt);
        preview.appendChild(row);
    });

    preview.appendChild(makeSep());

    const ts = document.createElement('div');
    ts.className = 'rp-timestamp';
    ts.textContent = formatTimestamp(new Date());
    preview.appendChild(ts);

    const tear = document.createElement('div');
    tear.className = 'rp-tear-line';
    tear.innerHTML = '<span>✂</span><div class="rp-tear-dashes"></div><span>✂</span>';
    preview.appendChild(tear);

    const hint = document.createElement('span');
    hint.className = 'rp-tear-hint';
    hint.textContent = '↑ pull to tear ↑';
    preview.appendChild(hint);
}

function makeSep() {
    const s = document.createElement('div');
    s.className = 'rp-separator';
    return s;
}

// ── Print Flow ───────────────────────────────────────────
async function handlePrint() {
    if (printerState !== 'idle') return;

    const texts = getItemTexts();
    if (texts.length === 0) {
        const c = document.getElementById('items-container');
        c.classList.add('shake');
        setTimeout(() => c.classList.remove('shake'), 400);
        const first = c.querySelector('.item-input');
        if (first) first.focus();
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
    buildReceiptPreview(currentTicketData);
    sounds.playPrint(2.1);

    await playPrintAnimation();

    printerState = 'ready';
    updateStatus('ready');
    const receipt = document.getElementById('receipt-preview');
    receipt.classList.add('tearable');

    breatheTween = gsap.to(receipt, {
        y: -4, duration: 1.3,
        repeat: -1, yoyo: true, ease: 'sine.inOut',
    });
}

// ── Print Animation ──────────────────────────────────────
function playPrintAnimation() {
    return new Promise(resolve => {
        const receipt = document.getElementById('receipt-preview');
        const printer = document.getElementById('printer');
        const led = document.getElementById('led');
        const printBtn = document.getElementById('print-btn');

        const tl = gsap.timeline({ onComplete: resolve });

        tl.to(printBtn, {
            y: 4,
            boxShadow: '0 1px 0 #252528, 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
            duration: 0.12, ease: 'power2.in',
        }, 0);

        tl.to(printer, {
            x: 0.8, duration: 0.035,
            repeat: 50, yoyo: true, ease: 'none',
        }, 0.15);

        tl.to(led, {
            backgroundColor: '#f0b840',
            boxShadow: '0 0 8px rgba(240,184,64,0.6)',
            duration: 0.12, repeat: 17, yoyo: true, ease: 'none',
        }, 0.15);

        tl.fromTo(receipt,
            { yPercent: 115 },
            { yPercent: 0, duration: 2, ease: 'steps(28)' },
            0.25,
        );

        tl.to(printBtn, {
            y: 0,
            boxShadow: '0 5px 0 #252528, 0 7px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
            duration: 0.25, ease: 'power2.out',
        }, '-=0.4');

        tl.to(led, {
            backgroundColor: '#50d890',
            boxShadow: '0 0 6px rgba(80,216,144,0.5)',
            duration: 0.3,
        }, '-=0.3');
    });
}

// ── Tear Interaction ─────────────────────────────────────
function setupTearInteraction() {
    const receipt = document.getElementById('receipt-preview');

    receipt.addEventListener('pointerdown', (e) => {
        if (printerState !== 'ready') return;
        e.preventDefault();

        if (breatheTween) { breatheTween.kill(); breatheTween = null; }

        const startY = e.clientY;
        let hasTorn = false;

        document.documentElement.style.cursor = 'grabbing';

        const onMove = (me) => {
            const delta = Math.max(0, startY - me.clientY);
            const progress = Math.min(delta / 60, 1);
            gsap.set(receipt, { y: -delta * 0.85, rotation: -progress * 3.5 });
            if (delta > 55 && !hasTorn) {
                hasTorn = true;
                cleanup();
                completeTear();
            }
        };

        const onUp = () => {
            cleanup();
            if (!hasTorn) {
                gsap.to(receipt, {
                    y: 0, rotation: 0, duration: 0.45,
                    ease: 'elastic.out(1, 0.45)',
                    onComplete: () => {
                        breatheTween = gsap.to(receipt, {
                            y: -4, duration: 1.3,
                            repeat: -1, yoyo: true, ease: 'sine.inOut',
                        });
                    },
                });
            }
        };

        const cleanup = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.documentElement.style.cursor = '';
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    });
}

// ── Complete Tear ────────────────────────────────────────
async function completeTear() {
    printerState = 'tearing';
    const receipt = document.getElementById('receipt-preview');
    const tray = document.getElementById('output-tray');

    receipt.classList.remove('tearable');
    sounds.playTear();
    tray.style.overflow = 'visible';
    receipt.style.clipPath = TORN_BOTTOM;

    await gsap.to(receipt, {
        y: '-=200', rotation: -4 - Math.random() * 4,
        opacity: 0, duration: 0.55, ease: 'power3.in',
    });

    try { await window.thermalAPI.printTicket(currentTicketData); }
    catch (err) { console.error('Failed to create ticket:', err); }

    resetPrinter();
}

// ── Cancel Pending Receipt ───────────────────────────────
function cancelPrint() {
    if (printerState !== 'ready') return;

    const receipt = document.getElementById('receipt-preview');
    if (breatheTween) { breatheTween.kill(); breatheTween = null; }

    receipt.classList.remove('tearable');

    gsap.to(receipt, {
        yPercent: 115, y: 0, rotation: 0,
        duration: 0.5, ease: 'power2.in',
        onComplete: () => {
            receipt.innerHTML = '';
            receipt.style.clipPath = '';
            setFormEnabled(true);
            updateStatus('idle');
            printerState = 'idle';
            currentTicketData = null;
        },
    });
}

// ── Reset Printer ────────────────────────────────────────
function resetPrinter() {
    const receipt = document.getElementById('receipt-preview');
    const tray = document.getElementById('output-tray');

    gsap.killTweensOf(receipt);
    if (breatheTween) { breatheTween.kill(); breatheTween = null; }

    gsap.set(receipt, { yPercent: 115, y: 0, rotation: 0, opacity: 1 });
    receipt.style.clipPath = '';
    receipt.classList.remove('tearable');
    receipt.innerHTML = '';
    tray.style.overflow = 'hidden';

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

function formatTimestamp(date) {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN',
        'JUL','AUG','SEP','OCT','NOV','DEC'];
    const M = months[date.getMonth()];
    const D = String(date.getDate()).padStart(2, '0');
    const Y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${M} ${D}, ${Y}  ${h}:${m}`;
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
        if (e.key === 'Escape' && printerState === 'ready') {
            cancelPrint();
        }
    });
}

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTitleBar();
    initColorSelector();
    initKeyboard();
    setupTearInteraction();

    const c = document.getElementById('items-container');
    c.appendChild(createItemRow());

    document.getElementById('add-item-btn').addEventListener('click', addItemRow);
    document.getElementById('print-btn').addEventListener('click', handlePrint);

    document.getElementById('paper-peek').style.backgroundColor = selectedColor;
    gsap.set('#receipt-preview', { yPercent: 115 });
});