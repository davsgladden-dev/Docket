// main.js — Electron Main Process
// This runs in Node.js, NOT in the browser. It creates and manages windows.

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

// ── Persistence Setup ──────────────────────────────────────────────
// electron-store saves JSON to the user's app data folder automatically.
// We'll store ticket data and window positions here.
const store = new Store({
    name: 'thermal-todo-data',
    defaults: {
        tickets: []
        // Each ticket: { id, title, items: [{text, done}], color, x, y, width, height, createdAt }
    }
});

// ── Window References ──────────────────────────────────────────────
let printerWindow = null;
const ticketWindows = new Map(); // id → BrowserWindow

// ── Printer Window ─────────────────────────────────────────────────
function createPrinterWindow() {
    printerWindow = new BrowserWindow({
        width: 400,          // was 380
        height: 740,         // was 660
        resizable: false,
        frame: false,
        transparent: false,
        backgroundColor: '#1a1a1e',   // darker to match new design
        webPreferences: {
            preload: path.join(__dirname, 'preload-printer.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    printerWindow.loadFile(path.join(__dirname, 'renderer', 'printer.html'));

    if (process.argv.includes('--dev')) {
        printerWindow.webContents.openDevTools({ mode: 'detach' });
    }

    printerWindow.on('closed', () => {
        printerWindow = null;
    });
}

// ── Ticket Window ──────────────────────────────────────────────────
function createTicketWindow(ticketData) {
    // Calculate a good size based on content
    const itemCount = ticketData.items.length;
    const hasTitle = ticketData.title && ticketData.title.trim().length > 0;
    const baseHeight = 60;                     // padding + date stamp
    const titleHeight = hasTitle ? 44 : 0;
    const itemHeight = itemCount * 36;
    const totalHeight = baseHeight + titleHeight + itemHeight + 40; // extra breathing room

    const ticketWidth = 300;

    // Default position: near the printer window, offset by ticket count
    const displays = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = displays.workAreaSize;
    const existingCount = ticketWindows.size;
    const defaultX = Math.min(420 + (existingCount * 30), screenW - ticketWidth);
    const defaultY = Math.min(100 + (existingCount * 30), screenH - totalHeight);

    // Use saved position if we're restoring from persistence
    const x = ticketData.x ?? defaultX;
    const y = ticketData.y ?? defaultY;

    const win = new BrowserWindow({
        width: ticketWidth,
        height: Math.max(totalHeight, 120),
        x: x,
        y: y,
        frame: false,              // No OS title bar
        transparent: true,         // Lets us see the torn paper edges
        alwaysOnTop: true,         // Sticky note behavior
        skipTaskbar: true,         // Don't clutter the taskbar
        hasShadow: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload-ticket.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(path.join(__dirname, 'renderer', 'ticket.html'));

    // Once the page is ready, send the ticket data to it
    win.webContents.once('did-finish-load', () => {
        win.webContents.send('ticket:data', ticketData);
    });

    // Track this window
    ticketWindows.set(ticketData.id, win);

    // Save position whenever the window moves
    win.on('moved', () => {
        const [wx, wy] = win.getPosition();
        updateTicketInStore(ticketData.id, { x: wx, y: wy });
    });

    // Clean up reference on close
    win.on('closed', () => {
        ticketWindows.delete(ticketData.id);
    });

    if (process.argv.includes('--dev')) {
        // win.webContents.openDevTools({ mode: 'detach' });
    }

    return win;
}

// ── Store Helpers ──────────────────────────────────────────────────
function saveTicketToStore(ticketData) {
    const tickets = store.get('tickets');
    tickets.push(ticketData);
    store.set('tickets', tickets);
}

function updateTicketInStore(id, updates) {
    const tickets = store.get('tickets');
    const index = tickets.findIndex(t => t.id === id);
    if (index !== -1) {
        tickets[index] = { ...tickets[index], ...updates };
        store.set('tickets', tickets);
    }
}

function removeTicketFromStore(id) {
    const tickets = store.get('tickets').filter(t => t.id !== id);
    store.set('tickets', tickets);
}

// ── IPC Handlers ───────────────────────────────────────────────────
// These are the "phone lines" between the renderer processes and main.

// Printer says "print this ticket!"
ipcMain.handle('printer:print-ticket', async (event, ticketData) => {
    // Generate a unique ID
    ticketData.id = `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    ticketData.createdAt = new Date().toISOString();

    // Save to persistent storage
    saveTicketToStore(ticketData);

    // Create the ticket window
    createTicketWindow(ticketData);

    return ticketData.id;
});

// Ticket says "I've been updated" (item checked/unchecked)
ipcMain.on('ticket:update-items', (event, { id, items }) => {
    updateTicketInStore(id, { items });
});

// Ticket says "discard me"
ipcMain.on('ticket:discard', (event, { id }) => {
    removeTicketFromStore(id);
    const win = ticketWindows.get(id);
    if (win && !win.isDestroyed()) {
        win.close();
    }
});

// Printer asks "what tickets exist?" (for restoring on startup)
ipcMain.handle('printer:get-tickets', async () => {
    return store.get('tickets');
});

// Ticket requests a window resize (after content renders)
ipcMain.on('ticket:resize', (event, { id, width, height }) => {
    const win = ticketWindows.get(id);
    if (win && !win.isDestroyed()) {
        win.setSize(Math.round(width), Math.round(height));
    }
});

// ── Window Control IPC ─────────────────────────────────────────
ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
});

ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});

// ── App Lifecycle ──────────────────────────────────────────────────
app.whenReady().then(async () => {
    createPrinterWindow();

    // Restore any saved tickets from last session
    const savedTickets = store.get('tickets');
    for (const ticket of savedTickets) {
        createTicketWindow(ticket);
    }
});

// macOS: re-create window when dock icon is clicked
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createPrinterWindow();
    }
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});