// ═══════════════════════════════════════════════════════════
// THERMAL TODO — PRINTER RENDERER
// ═══════════════════════════════════════════════════════════

// ── Constants ────────────────────────────────────────────
const COLORS = [
    '#FFF9C4', '#C8F5E0', '#FFD6D6', '#D6EDFF',
    '#E8D6FF', '#FFE5CC', '#F5F2EE', '#D8EDD8'
];

// Clip-path for the torn bottom edge of the receipt during tear-away
const TORN_BOTTOM = `polygon(
  0% 0%, 100% 0%,
  100% calc(100% - 10px),
  97% calc(100% - 4px), 94% calc(100% - 9px), 91% calc(100% - 2px),
  88% calc(100% - 7px), 85% calc(100% - 10px), 82% calc(100% - 3px),
  79% calc(100% - 8px), 76% calc(100% - 5px), 73% calc(100% - 11px),
  70% calc(100% - 2px), 67% calc(100% - 7px), 64% calc(100% - 10px),
  61% calc(100% - 4px), 58% calc(100% - 8px), 55% calc(100% - 1px),
  52% calc(100% - 6px), 49% calc(100% - 9px), 46% calc(100% - 3px),
  43% calc(100% - 7px), 40% calc(100% - 11px), 37% calc(100% - 4px),
  34% calc(100% - 8px), 31% calc(100% - 1px), 28% calc(100% - 6px),
  25% calc(100% - 10px), 22% calc(100% - 3px), 19% calc(100% - 9px),
  16% calc(100% - 5px), 13% calc(100% - 8px), 10% calc(100% - 2px),
  7% calc(100% - 7px), 4% calc(100% - 10px), 1% calc(100% - 4px),
  0% calc(100% - 7px)
)`;

// ── State ────────────────────────────────────────────────
let printerState = 'idle';   // idle → printing → ready → tearing → idle
let selectedColor = COLORS[0];
let currentTicketData = null;
let breatheTween = null;     // gentle bob animation while ready-to-tear

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
    const row = createItemRow();
    container.appendChild(row);
    row.querySelector('input').focus();
    container.scrollTop = container.scrollHeight;
}

function getItemTexts() {
    const inputs = document.querySelectorAll('.item-input');
    const texts = [];
    inputs.forEach(inp => {
        const t = inp.value.trim();
        if (t) texts.push(t);
    });
    return texts;
}

// ── Receipt Preview Builder ──────────────────────────────
function buildReceiptPreview(data) {
    const preview = document.getElementById('receipt-preview');
    preview.style.backgroundColor = data.color;
    preview.innerHTML = '';  // clear previous

    // Title
    if (data.title) {
        const title = document.createElement('div');
        title.className = 'rp-title';
        title.textContent = data.title;
        preview.appendChild(title);
    }

    // Top separator
    preview.appendChild(makeSeparator());

    // Items
    data.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'rp-item';

        const checkbox = document.createElement('div');
        checkbox.className = 'rp-checkbox';

        const text = document.createElement('span');
        text.className = 'rp-item-text';
        text.textContent = item.text;

        row.append(checkbox, text);
        preview.appendChild(row);
    });

    // Bottom separator
    preview.appendChild(makeSeparator());

    // Timestamp
    const ts = document.createElement('div');
    ts.className = 'rp-timestamp';
    ts.textContent = formatTimestamp(new Date());
    preview.appendChild(ts);

    // Tear line indicator
    const tearLine = document.createElement('div');
    tearLine.className = 'rp-tear-line';
    tearLine.innerHTML =
        '<span>✂</span><div class="rp-tear-dashes"></div><span>✂</span>';
    preview.appendChild(tearLine);

    // Tear hint
    const hint = document.createElement('span');
    hint.className = 'rp-tear-hint';
    hint.textContent = '↑ pull to tear ↑';
    preview.appendChild(hint);
}

function makeSeparator() {
    const sep = document.createElement('div');
    sep.className = 'rp-separator';
    return sep;
}

// ── Print Flow ───────────────────────────────────────────
async function handlePrint() {
    if (printerState !== 'idle') return;

    // Gather & validate items
    const texts = getItemTexts();
    if (texts.length === 0) {
        const container = document.getElementById('items-container');
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 400);
        const firstInput = container.querySelector('.item-input');
        if (firstInput) firstInput.focus();
        return;
    }

    const title = document.getElementById('ticket-title').value.trim();

    // Build ticket data (no id/createdAt yet — main process adds those)
    currentTicketData = {
        title,
        items: texts.map(t => ({ text: t, done: false })),
        color: selectedColor
    };

    // Transition to printing
    printerState = 'printing';
    setFormEnabled(false);

    // Build the receipt preview DOM
    buildReceiptPreview(currentTicketData);

    // Run the print animation
    await playPrintAnimation();

    // Transition to ready-to-tear
    printerState = 'ready';
    const receipt = document.getElementById('receipt-preview');
    receipt.classList.add('tearable');

    // Gentle floating bob to indicate interactivity
    breatheTween = gsap.to(receipt, {
        y: -4,
        duration: 1.3,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
    });
}

// ── Print Animation (GSAP Timeline) ─────────────────────
function playPrintAnimation() {
    return new Promise(resolve => {
        sounds.playPrint(2.1);

        const receipt  = document.getElementById('receipt-preview');
        const printer  = document.querySelector('.printer');
        const led      = document.getElementById('led');
        const printBtn = document.getElementById('print-btn');

        const tl = gsap.timeline({ onComplete: resolve });

        // 1. Button press
        tl.to(printBtn, {
            y: 4,
            boxShadow: '0 1px 0 #252528, 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
            duration: 0.12,
            ease: 'power2.in'
        }, 0);

        // 2. Printer vibration (stepper motor)
        tl.to(printer, {
            x: 0.8,
            duration: 0.035,
            repeat: 50,
            yoyo: true,
            ease: 'none'
        }, 0.15);

        // 3. LED blinks amber during print
        tl.to(led, {
            backgroundColor: '#f0b840',
            boxShadow: '0 0 8px rgba(240,184,64,0.6)',
            duration: 0.12,
            repeat: 17,
            yoyo: true,
            ease: 'none'
        }, 0.15);

        // 4. Receipt feeds up out of the slot (stepped = stepper motor feel)
        tl.fromTo(receipt,
            { yPercent: 115 },
            {
                yPercent: 0,
                duration: 2,
                ease: 'steps(28)'
            },
            0.25
        );

        // 5. Button release
        tl.to(printBtn, {
            y: 0,
            boxShadow: '0 5px 0 #252528, 0 7px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
            duration: 0.25,
            ease: 'power2.out'
        }, '-=0.4');

        // 6. LED back to green
        tl.to(led, {
            backgroundColor: '#50d890',
            boxShadow: '0 0 6px rgba(80,216,144,0.5)',
            duration: 0.3
        }, '-=0.3');
    });
}

// ── Tear Interaction (drag-to-tear) ──────────────────────
function setupTearInteraction() {
    const receipt = document.getElementById('receipt-preview');

    receipt.addEventListener('pointerdown', (e) => {
        if (printerState !== 'ready') return;
        e.preventDefault();

        // Kill the breathing bob
        if (breatheTween) { breatheTween.kill(); breatheTween = null; }

        const startY = e.clientY;
        let hasTorn = false;

        document.documentElement.style.cursor = 'grabbing';

        const onMove = (moveEvt) => {
            const delta = Math.max(0, startY - moveEvt.clientY);
            const progress = Math.min(delta / 60, 1);

            // Receipt follows the drag
            gsap.set(receipt, {
                y: -delta * 0.85,
                rotation: -progress * 3.5
            });

            // Threshold reached → tear!
            if (delta > 55 && !hasTorn) {
                hasTorn = true;
                cleanup();
                completeTear();
            }
        };

        const onUp = () => {
            cleanup();
            if (!hasTorn) {
                // Snap back with elastic bounce
                gsap.to(receipt, {
                    y: 0, rotation: 0,
                    duration: 0.45,
                    ease: 'elastic.out(1, 0.45)',
                    onComplete: () => {
                        // Restart breathing
                        breatheTween = gsap.to(receipt, {
                            y: -4, duration: 1.3,
                            repeat: -1, yoyo: true, ease: 'sine.inOut'
                        });
                    }
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
    const tray    = document.getElementById('output-tray');

    receipt.classList.remove('tearable');

    sounds.playTear();

    // Let the receipt escape the tray bounds
    tray.style.overflow = 'visible';

    // Apply the torn bottom edge
    receipt.style.clipPath = TORN_BOTTOM;

    // Fly the receipt up and away
    await gsap.to(receipt, {
        y: '-=200',
        rotation: -4 - Math.random() * 4,
        opacity: 0,
        duration: 0.55,
        ease: 'power3.in'
    });

    // Create the actual ticket window via IPC
    try {
        await window.thermalAPI.printTicket(currentTicketData);
    } catch (err) {
        console.error('Failed to create ticket:', err);
    }

    // Reset everything
    resetPrinter();
}

// ── Reset Printer ────────────────────────────────────────
function resetPrinter() {
    const receipt = document.getElementById('receipt-preview');
    const tray    = document.getElementById('output-tray');

    // Kill any lingering tweens
    gsap.killTweensOf(receipt);
    if (breatheTween) { breatheTween.kill(); breatheTween = null; }

    // Reset receipt position & state
    gsap.set(receipt, { yPercent: 115, y: 0, rotation: 0, opacity: 1 });
    receipt.style.clipPath = '';
    receipt.classList.remove('tearable');
    receipt.innerHTML = '';

    // Restore tray clipping
    tray.style.overflow = 'hidden';

    // Re-enable the form
    setFormEnabled(true);
    resetForm();

    printerState = 'idle';
    currentTicketData = null;
}

function resetForm() {
    document.getElementById('ticket-title').value = '';
    const container = document.getElementById('items-container');
    container.innerHTML = '';
    container.appendChild(createItemRow());
}

// ── Helpers ──────────────────────────────────────────────
function setFormEnabled(enabled) {
    const panel = document.getElementById('control-panel');
    const btn   = document.getElementById('print-btn');

    if (enabled) {
        panel.classList.remove('disabled');
        btn.disabled = false;
    } else {
        panel.classList.add('disabled');
        btn.disabled = true;
    }
}

function formatTimestamp(date) {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN',
        'JUL','AUG','SEP','OCT','NOV','DEC'];
    const M   = months[date.getMonth()];
    const D   = String(date.getDate()).padStart(2, '0');
    const Y   = date.getFullYear();
    const h   = String(date.getHours()).padStart(2, '0');
    const m   = String(date.getMinutes()).padStart(2, '0');
    return `${M} ${D}, ${Y}  ${h}:${m}`;
}

// ── Title Bar Controls ───────────────────────────────────
function initTitleBar() {
    document.getElementById('btn-minimize').addEventListener('click', () => {
        window.thermalAPI.minimizeWindow();
    });
    document.getElementById('btn-close').addEventListener('click', () => {
        window.thermalAPI.closeWindow();
    });
}

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTitleBar();
    initColorSelector();

    // Initial empty item row
    const container = document.getElementById('items-container');
    container.appendChild(createItemRow());

    // Buttons
    document.getElementById('add-item-btn').addEventListener('click', addItemRow);
    document.getElementById('print-btn').addEventListener('click', handlePrint);

    // Set up the drag-to-tear (registered once, state-gated internally)
    setupTearInteraction();

    // Set initial receipt position (hidden below tray)
    gsap.set('#receipt-preview', { yPercent: 115 });
});