// ═══════════════════════════════════════════════════════════
// THERMAL TODO — TICKET RENDERER
// With confetti celebration + sound effects
// ═══════════════════════════════════════════════════════════

let ticketData = null;
let confettiCooldown = false;

// ── Confetti color palette ───────────────────────────────
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

    // Request proper window size
    requestAnimationFrame(() => {
        const rect = ticket.getBoundingClientRect();
        window.ticketAPI.resize(
            ticketData.id,
            Math.ceil(rect.width) + 8,
            Math.ceil(rect.height) + 22
        );
    });
}

// ── Toggle Item ──────────────────────────────────────────
function toggleItem(index) {
    const wasDone = ticketData.items[index].done;
    ticketData.items[index].done = !wasDone;

    // Play appropriate sound
    if (!wasDone) {
        sounds.playCheck();
    } else {
        sounds.playUncheck();
    }

    // Re-render
    renderTicket();

    // Persist
    window.ticketAPI.updateItems(ticketData.id, ticketData.items);

    // Check if ALL items are now done → celebrate!
    const allDone = ticketData.items.every(item => item.done);
    if (allDone && !wasDone) {
        // Small delay for the "wait for it..." moment
        setTimeout(() => celebrateCompletion(), 350);
    }
}

// ── Confetti Celebration ─────────────────────────────────
function celebrateCompletion() {
    // Cooldown prevents rapid-fire confetti spam
    if (confettiCooldown) return;
    confettiCooldown = true;
    setTimeout(() => { confettiCooldown = false; }, 2500);

    // 🔊 Play the ta-da sound
    sounds.playConfetti();

    // 💫 Quick scale pulse on the ticket
    const ticket = document.getElementById('ticket');
    ticket.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    ticket.style.transform = 'scale(1.05)';
    setTimeout(() => {
        ticket.style.transform = 'scale(1)';
        // Clean up so the transition doesn't interfere with dragging
        setTimeout(() => { ticket.style.transition = ''; }, 200);
    }, 200);

    // 🎊 Main confetti burst — center of ticket
    confetti({
        particleCount: 60,
        spread: 55,
        startVelocity: 25,
        origin: { x: 0.5, y: 0.5 },
        colors: CONFETTI_COLORS,
        ticks: 130,
        gravity: 0.8,
        scalar: 0.9,
        shapes: ['square', 'circle'],
        disableForReducedMotion: true,
    });

    // 🎊 Follow-up burst — wider, lighter
    setTimeout(() => {
        confetti({
            particleCount: 30,
            spread: 100,
            startVelocity: 15,
            origin: { x: 0.5, y: 0.4 },
            colors: CONFETTI_COLORS,
            ticks: 90,
            gravity: 1.2,
            scalar: 0.65,
            shapes: ['circle'],
        });
    }, 180);

    // 🎊 Final sparkle burst
    setTimeout(() => {
        confetti({
            particleCount: 15,
            spread: 120,
            startVelocity: 10,
            origin: { x: 0.5, y: 0.6 },
            colors: CONFETTI_COLORS,
            ticks: 70,
            gravity: 1.5,
            scalar: 0.5,
            shapes: ['square'],
        });
    }, 350);
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

// ── Discard ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-btn').addEventListener('click', () => {
        if (ticketData) window.ticketAPI.discard(ticketData.id);
    });
});