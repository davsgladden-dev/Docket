// ═══════════════════════════════════════════════════════════
// THERMAL TODO — TICKET RENDERER
// ═══════════════════════════════════════════════════════════

let ticketData = null;

// ── Receive data from main process ───────────────────────
window.ticketAPI.onTicketData((data) => {
    ticketData = data;
    renderTicket();
});

// ── Render ───────────────────────────────────────────────
function renderTicket() {
    const ticket  = document.getElementById('ticket');
    const tornEdge = document.getElementById('torn-edge');

    // Set color on both ticket body AND torn edge
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

    // Request proper window size from main process
    requestAnimationFrame(() => {
        const rect = ticket.getBoundingClientRect();
        // +14 top for torn edge, +8 bottom for shadow/padding
        window.ticketAPI.resize(
            ticketData.id,
            Math.ceil(rect.width) + 8,
            Math.ceil(rect.height) + 22
        );
    });
}

// ── Toggle Item ──────────────────────────────────────────
function toggleItem(index) {
    ticketData.items[index].done = !ticketData.items[index].done;
    renderTicket();
    window.ticketAPI.updateItems(ticketData.id, ticketData.items);

    // Check if ALL done
    if (ticketData.items.every(item => item.done)) {
        console.log('🎉 All done! Confetti coming in a future phase.');
    }
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