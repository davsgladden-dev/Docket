// ═══════════════════════════════════════════════════════════
// THERMAL TODO — TICKET RENDERER
// Confetti, sounds, crumple animation, resize bug fix
// ═══════════════════════════════════════════════════════════

let ticketData = null;
let confettiCooldown = false;
let isDiscarding = false;
let initialSizeDone = false;       // ← BUG FIX: tracks first resize

// ── Confetti colors ──────────────────────────────────────
const CONFETTI_COLORS = [
    '#FF6B6B', '#FFD93D', '#6BCB77',
    '#4D96FF', '#C06BFF', '#FF9F43'
];

// ── Receive data from main process ───────────────────────
window.ticketAPI.onTicketData((data) => {
    ticketData = data;
    renderTicket();
});

// ── Render ───────────────────────────────────────────────
function renderTicket() {
    const ticket   = document.getElementById('ticket');
    const tornEdge = document.getElementById('torn-edge');

    // Set color on both body and torn edge
    ticket.style.setProperty('--ticket-color', ticketData.color);
    ticket.style.backgroundColor = ticketData.color;
    tornEdge.style.backgroundColor = ticketData.color;

    // Title
    const titleEl = document.getElementById('ticket-title');
    titleEl.textContent = ticketData.title || '';

    // Items
    const itemsEl = document.getElementById('ticket-items');
    itemsEl.innerHTML = '';

    ticketData.items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = `ticket-item${item.done ? ' done' : ''}`;

        const checkbox = document.createElement('div');
        checkbox.className = 'ticket-checkbox';
        checkbox.textContent = '✓';

        const text = document.createElement('span');
        text.className = 'ticket-item-text';
        text.textContent = item.text;

        row.append(checkbox, text);
        row.addEventListener('click', () => toggleItem(index));
        itemsEl.appendChild(row);
    });

    // Timestamp
    const tsEl = document.getElementById('ticket-timestamp');
    const date = new Date(ticketData.createdAt);
    tsEl.textContent = formatTimestamp(date);

    // ── BUG FIX: Only resize ONCE on first render ─────────
    if (!initialSizeDone) {
        initialSizeDone = true;
        requestAnimationFrame(() => {
            const rect = ticket.getBoundingClientRect();
            const finalWidth  = Math.ceil(rect.width) + 8;
            const finalHeight = Math.ceil(rect.height) + 22;

            // Lock the ticket element's width so it can never grow
            // even if something accidentally triggers a resize later
            ticket.style.width = rect.width + 'px';

            window.ticketAPI.resize(ticketData.id, finalWidth, finalHeight);
        });
    }
}

// ── Toggle Item ──────────────────────────────────────────
function toggleItem(index) {
    if (isDiscarding) return;

    const wasDone = ticketData.items[index].done;
    ticketData.items[index].done = !wasDone;

    // Sound
    if (!wasDone) {
        sounds.playCheck();
    } else {
        sounds.playUncheck();
    }

    renderTicket();
    window.ticketAPI.updateItems(ticketData.id, ticketData.items);

    // All done? Celebrate!
    const allDone = ticketData.items.every(item => item.done);
    if (allDone && !wasDone) {
        setTimeout(() => celebrateCompletion(), 350);
    }
}

// ── Confetti Celebration ─────────────────────────────────
function celebrateCompletion() {
    if (confettiCooldown || isDiscarding) return;
    confettiCooldown = true;
    setTimeout(() => { confettiCooldown = false; }, 2500);

    sounds.playConfetti();

    // Quick scale pulse
    const ticket = document.getElementById('ticket');
    ticket.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    ticket.style.transform = 'scale(1.05)';
    setTimeout(() => {
        ticket.style.transform = 'scale(1)';
        setTimeout(() => { ticket.style.transition = ''; }, 200);
    }, 200);

    // Main burst
    confetti({
        particleCount: 60, spread: 55, startVelocity: 25,
        origin: { x: 0.5, y: 0.5 },
        colors: CONFETTI_COLORS, ticks: 130,
        gravity: 0.8, scalar: 0.9,
        shapes: ['square', 'circle'],
        disableForReducedMotion: true,
    });

    // Follow-up burst
    setTimeout(() => {
        confetti({
            particleCount: 30, spread: 100, startVelocity: 15,
            origin: { x: 0.5, y: 0.4 },
            colors: CONFETTI_COLORS, ticks: 90,
            gravity: 1.2, scalar: 0.65, shapes: ['circle'],
        });
    }, 180);

    // Final sparkle
    setTimeout(() => {
        confetti({
            particleCount: 15, spread: 120, startVelocity: 10,
            origin: { x: 0.5, y: 0.6 },
            colors: CONFETTI_COLORS, ticks: 70,
            gravity: 1.5, scalar: 0.5, shapes: ['square'],
        });
    }, 350);
}

// ── Crumple & Discard ────────────────────────────────────
async function crumpleAndDiscard() {
    if (isDiscarding) return;
    isDiscarding = true;

    const ticket   = document.getElementById('ticket');
    const tornEdge = document.getElementById('torn-edge');

    // Stop confetti if running
    if (typeof confetti !== 'undefined' && confetti.reset) {
        confetti.reset();
    }

    // Kill interactivity immediately
    ticket.style.pointerEvents = 'none';

    // 🔊 Crumple sound
    sounds.playCrumple();

    const tl = gsap.timeline();

    // Fade torn edge fast (it would look weird crumpling)
    tl.to(tornEdge, { opacity: 0, duration: 0.06 }, 0);

    // Phase 1: Initial grab/scrunch — edges pull in, slight tilt
    tl.to(ticket, {
        scaleX: 0.7,
        scaleY: 0.85,
        rotation: -8,
        skewX: 3,
        duration: 0.1,
        ease: 'power2.in',
    }, 0.02);

    // Phase 2: Cross-squeeze — direction reverses, getting rounder
    tl.to(ticket, {
        scaleX: 0.45,
        scaleY: 0.4,
        rotation: 14,
        skewX: -5,
        skewY: 3,
        borderRadius: '18%',
        duration: 0.12,
        ease: 'power2.in',
    });

    // Phase 3: Ball up — rapid compression into a wad
    tl.to(ticket, {
        scale: 0.1,
        rotation: 30 + Math.random() * 30,
        skewX: 0,
        skewY: 0,
        borderRadius: '45%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        duration: 0.16,
        ease: 'power3.in',
    });

    // Phase 4: Drop + vanish — paper wad falls away
    tl.to(ticket, {
        y: '+=55',
        scale: 0.03,
        opacity: 0,
        duration: 0.14,
        ease: 'power2.in',
    });

    await tl;

    // Tell main process to destroy the window
    window.ticketAPI.discard(ticketData.id);
}

// ── Timestamp Formatter ──────────────────────────────────
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

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-btn').addEventListener('click', () => {
        if (ticketData) crumpleAndDiscard();   // ← crumple instead of instant discard
    });
});