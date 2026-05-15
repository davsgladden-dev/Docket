// renderer/printer.js
// This runs in the RENDERER process (browser context).
// It can only talk to main.js through the thermalAPI bridge.

// ── Color Palette ────────────────────────────────────────────────
const COLORS = [
    '#FFF9C4',  // Butter yellow
    '#C8F5E0',  // Mint green
    '#FFD6D6',  // Soft pink
    '#D6EDFF',  // Baby blue
    '#E8D6FF',  // Lavender
    '#FFE5CC',  // Peach
    '#F5F2EE',  // Off-white / classic receipt
    '#D8EDD8',  // Sage
];

let selectedColor = COLORS[0];

// ── Initialize Color Selector ────────────────────────────────────
function initColorSelector() {
    const container = document.getElementById('color-selector');
    COLORS.forEach((color, index) => {
        const swatch = document.createElement('div');
        swatch.className = `color-swatch${index === 0 ? ' selected' : ''}`;
        swatch.style.backgroundColor = color;
        swatch.dataset.color = color;
        swatch.addEventListener('click', () => selectColor(color, swatch));
        container.appendChild(swatch);
    });
}

function selectColor(color, swatch) {
    selectedColor = color;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
}

// ── Item Management ──────────────────────────────────────────────
function createItemRow(value = '') {
    const row = document.createElement('div');
    row.className = 'item-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'thermal-input item-input';
    input.placeholder = 'Add item...';
    input.maxLength = 50;
    input.value = value;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-item-btn';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
        const container = document.getElementById('items-container');
        if (container.children.length > 1) {
            row.remove();
        } else {
            // Don't remove the last row, just clear it
            input.value = '';
            input.focus();
        }
    });

    // Enter key on an item input adds a new row
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItemRow();
        }
    });

    row.appendChild(input);
    row.appendChild(removeBtn);
    return row;
}

function addItemRow() {
    const container = document.getElementById('items-container');
    const row = createItemRow();
    container.appendChild(row);
    row.querySelector('input').focus();
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// ── Print Handler ────────────────────────────────────────────────
async function handlePrint() {
    const title = document.getElementById('ticket-title').value.trim();

    // Gather non-empty items
    const itemInputs = document.querySelectorAll('.item-input');
    const items = [];
    itemInputs.forEach(input => {
        const text = input.value.trim();
        if (text) {
            items.push({ text: text, done: false });
        }
    });

    // Validate: at least one item
    if (items.length === 0) {
        // Quick shake animation on the items container
        const container = document.getElementById('items-container');
        container.style.animation = 'shake 0.3s ease';
        setTimeout(() => container.style.animation = '', 300);
        document.querySelector('.item-input').focus();
        return;
    }

    // Build ticket data
    const ticketData = {
        title: title,
        items: items,
        color: selectedColor
    };

    // Disable button during "printing"
    const printBtn = document.getElementById('print-btn');
    printBtn.classList.add('printing');
    printBtn.textContent = '🖨️ PRINTING...';

    try {
        // Send to main process → creates ticket window
        const ticketId = await window.thermalAPI.printTicket(ticketData);
        console.log('Printed ticket:', ticketId);

        // Reset the form
        resetForm();
    } catch (err) {
        console.error('Print failed:', err);
    }

    // Re-enable button
    setTimeout(() => {
        printBtn.classList.remove('printing');
        printBtn.textContent = '🖨️ PRINT';
    }, 800);
}

function resetForm() {
    document.getElementById('ticket-title').value = '';
    const container = document.getElementById('items-container');
    container.innerHTML = '';
    container.appendChild(createItemRow());
}

// ── Title Bar Controls ───────────────────────────────────────────
function initTitleBar() {
    document.getElementById('btn-minimize').addEventListener('click', () => {
        window.thermalAPI.minimizeWindow();
    });
    document.getElementById('btn-close').addEventListener('click', () => {
        window.thermalAPI.closeWindow();
    });
}

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTitleBar();
    initColorSelector();

    // Initialize items with one empty row
    const container = document.getElementById('items-container');
    container.innerHTML = '';
    container.appendChild(createItemRow());

    // Add item button
    document.getElementById('add-item-btn').addEventListener('click', addItemRow);

    // Print button
    document.getElementById('print-btn').addEventListener('click', handlePrint);
});