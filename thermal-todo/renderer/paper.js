// ═══════════════════════════════════════════════════════════
// DOCKET — PAPER WINDOW RENDERER
// Handles receipt display, emerge animation, and tear interaction.
// This window is created by main when printing starts and is
// positioned so its bottom edge aligns with the printer slot mouth.
// ═══════════════════════════════════════════════════════════

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

let ticketData = null;
let breatheTween = null;

// ── Receipt Builder ──────────────────────────────────────
function buildReceipt(data) {
    const receipt = document.getElementById('receipt-preview');
    receipt.style.backgroundColor = data.color;
    receipt.innerHTML = '';

    if (data.title) {
        const title = document.createElement('div');
        title.className = 'rp-title';
        title.textContent = data.title;
        receipt.appendChild(title);
    }

    receipt.appendChild(makeSep());

    data.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'rp-item';
        const cb = document.createElement('div');
        cb.className = 'rp-checkbox';
        const txt = document.createElement('span');
        txt.className = 'rp-item-text';
        txt.textContent = item.text;
        row.append(cb, txt);
        receipt.appendChild(row);
    });

    receipt.appendChild(makeSep());

    const ts = document.createElement('div');
    ts.className = 'rp-timestamp';
    ts.textContent = formatTimestamp(new Date());
    receipt.appendChild(ts);

    const tear = document.createElement('div');
    tear.className = 'rp-tear-line';
    tear.innerHTML = '<span>✂</span><div class="rp-tear-dashes"></div><span>✂</span>';
    receipt.appendChild(tear);

    const hint = document.createElement('span');
    hint.className = 'rp-tear-hint';
    hint.textContent = '↑ pull to tear ↑';
    receipt.appendChild(hint);
}

function makeSep() {
    const s = document.createElement('div');
    s.className = 'rp-separator';
    return s;
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

// ── Emerge Animation ─────────────────────────────────────
async function emerge() {
    const receipt = document.getElementById('receipt-preview');

    // Position below the window bottom and restore opacity (CSS starts at 0 to prevent
    // any flash before this runs). Content below window bounds is OS-clipped = invisible.
    gsap.set(receipt, { yPercent: 100, y: 0, opacity: 1 });

    sounds.playPrint(2.1);

    await new Promise(resolve => {
        gsap.to(receipt, {
            yPercent: 0,
            y: 0,
            duration: 2,
            ease: 'steps(28)',
            delay: 0.25,
            onComplete: resolve,
        });
    });

    receipt.classList.add('tearable');

    breatheTween = gsap.to(receipt, {
        y: -4, duration: 1.3,
        repeat: -1, yoyo: true, ease: 'sine.inOut',
    });

    window.paperAPI.paperReady();
}

// ── Tear Interaction ─────────────────────────────────────
function setupTear() {
    const receipt = document.getElementById('receipt-preview');

    receipt.addEventListener('pointerdown', (e) => {
        if (!receipt.classList.contains('tearable')) return;
        e.preventDefault();

        if (breatheTween) { breatheTween.kill(); breatheTween = null; }

        const startY = e.clientY;
        let hasTorn = false;

        document.documentElement.style.cursor = 'grabbing';

        const onMove = (me) => {
            const delta = Math.max(0, startY - me.clientY);
            const progress = Math.min(delta / 60, 1);
            gsap.set(receipt, {
                y: -delta * 0.85,
                rotation: -progress * 3.5,
            });
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
    const receipt = document.getElementById('receipt-preview');
    receipt.classList.remove('tearable');
    sounds.playTear();
    receipt.style.clipPath = TORN_BOTTOM;

    await gsap.to(receipt, {
        y: '-=220', rotation: -4 - Math.random() * 4,
        opacity: 0, duration: 0.55, ease: 'power3.in',
    });

    window.paperAPI.torn(ticketData);
}

// ── Mouse Click-Through ──────────────────────────────────
// Transparent areas of the paper window pass clicks through to the desktop.
// Interactive only when the cursor is over the receipt itself.
function initMouseThrough() {
    window.paperAPI.setIgnoreMouseEvents(true);
    document.addEventListener('mousemove', (e) => {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        window.paperAPI.setIgnoreMouseEvents(!el || !el.closest('.receipt-preview'));
    });
}

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initMouseThrough();
    setupTear();

    window.paperAPI.onData((data) => {
        ticketData = data;
        buildReceipt(data);
        emerge();
    });
});
