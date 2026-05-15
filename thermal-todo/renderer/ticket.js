// renderer/ticket.js
// Runs inside each ticket window's renderer process.

let ticketData = null;

// ── Receive Data from Main Process ───────────────────────────────
window.ticketAPI.onTicketData((data) => {
    ticketData = data;
    renderTicket();
});

// ── Render Ticket ────────────────────────────────────────────────
function renderTicket() {
    const ticket = document.getElementById('ticket');

    // Set the ticket color as a CSS variable
    ticket.style.setProperty('--ticket-color', ticketData.color);
    ticket.style.backgroundColor = ticketData.color;

    // Title
    const titleEl = document.getElementById('ticket-title');
    if (ticketData.title) {
        titleEl.textContent = ticketData.title;
    } else {
        titleEl.textContent = '';
    }

    // Items
    const itemsContainer = document.getElementById('ticket-items');
    itemsContainer.innerHTML = '';

    ticketData.items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = `ticket-item${item.done ? ' done' : ''}`;

        const checkbox = document.createElement('div');
        checkbox.className = 'ticket-checkbox';
        checkbox.textContent = '✓';

        const text = document.createElement('span');
        text.className = 'ticket-item-text';
        text.textContent = item.text;

        row.appendChild(checkbox);
        row.appendChild(text);

        // Click to toggle done
        row.addEventListener('click', () => toggleItem(index));

        itemsContainer.appendChild(row);
    });

    // Timestamp
    const tsEl = document.getElementById('ticket-timestamp');
    const date = new Date(ticketData.createdAt);
    tsEl.textContent = formatTimestamp(date);

    // Request proper window sizing after render
    requestAnimationFrame(() => {
        const rect = ticket.getBoundingClientRect();
        // Add some padding for the transparent edges
        window.ticketAPI.resize(ticketData.id, rect.width + 8, rect.height + 8);
    });
}

// ── Toggle Item ──────────────────────────────────────────────────
function toggleItem(index) {
    ticketData.items[index].done = !ticketData.items[index].done;

    // Re-render
    renderTicket();

    // Persist to main process
    window.ticketAPI.updateItems(ticketData.id, ticketData.items);

    // Check if ALL items are done → confetti! (we'll add this later)
    const allDone = ticketData.items.every(item => item.done);
    if (allDone) {
        console.log('🎉 All done! Confetti goes here.');
        // TODO: confetti burst
    }
}

// ── Format Timestamp ─────────────────────────────────────────────
function formatTimestamp(date) {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const month = months[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${month} ${day}, ${year}  ${hours}:${mins}`;
}

// ── Close / Discard ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-btn').addEventListener('click', () => {
        if (ticketData) {
            window.ticketAPI.discard(ticketData.id);
        }
    });
});