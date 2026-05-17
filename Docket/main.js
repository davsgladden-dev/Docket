const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
    name: 'docket-data',
    defaults: { tickets: [] },
    clearInvalidConfig: true,
});

let printerWindow = null;
let paperWindow = null;
const ticketWindows = new Map();
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');

// ── Printer Window ───────────────────────────────────────
function createPrinterWindow() {
    printerWindow = new BrowserWindow({
        width: 380,
        height: 600,
        resizable: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        icon: ICON_PATH,
        webPreferences: {
            preload: path.join(__dirname, 'preload-printer.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    printerWindow.loadFile(path.join(__dirname, 'renderer', 'printer.html'));

    if (process.argv.includes('--dev')) {
        printerWindow.webContents.openDevTools({ mode: 'detach' });
    }

    printerWindow.on('closed', () => {
        printerWindow = null;
        if (process.platform !== 'darwin') app.quit();
    });
}

// ── Paper Window ─────────────────────────────────────────
// Created when printing starts. Positioned above the printer slot mouth.
// Fixed height covers the maximum possible receipt height.
function createPaperWindow(ticketData) {
    if (!printerWindow || printerWindow.isDestroyed()) return;
    if (paperWindow && !paperWindow.isDestroyed()) {
        paperWindow.close();
    }

    const PAPER_H = 520;
    const PAPER_W = 320;
    // Slot mouth is at y≈46 from the printer window top (slot top=24px + slot height=22px).
    const SLOT_MOUTH_Y = 46;
    const [px, py] = printerWindow.getPosition();
    const paperX = px + Math.round((380 - PAPER_W) / 2);
    const paperY = py + SLOT_MOUTH_Y - PAPER_H;

    paperWindow = new BrowserWindow({
        width: PAPER_W,
        height: PAPER_H,
        x: paperX,
        y: paperY,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        resizable: false,
        show: false,
        icon: ICON_PATH,
        webPreferences: {
            preload: path.join(__dirname, 'preload-paper.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    paperWindow.setIgnoreMouseEvents(true, { forward: true });
    paperWindow.once('ready-to-show', () => {
        if (!paperWindow || paperWindow.isDestroyed()) return;
        paperWindow.show();
    });
    paperWindow.loadFile(path.join(__dirname, 'renderer', 'paper.html'));
    paperWindow.webContents.once('did-finish-load', () => {
        if (!paperWindow || paperWindow.isDestroyed()) return;
        paperWindow.webContents.send('paper:data', ticketData);
    });

    paperWindow.on('closed', () => { paperWindow = null; });
}

// ── Ticket Windows ───────────────────────────────────────
function createTicketWindow(ticketData) {
    const itemCount = ticketData.items.length;
    const hasTitle = ticketData.title && ticketData.title.trim().length > 0;
    const baseHeight = 60;
    const titleHeight = hasTitle ? 44 : 0;
    const itemHeight = itemCount * 36;
    const totalHeight = baseHeight + titleHeight + itemHeight + 40;
    const ticketWidth = 300;

    const { workAreaSize } = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = workAreaSize;
    const existingCount = ticketWindows.size;

    const [printerX, printerY] = printerWindow ? printerWindow.getPosition() : [0, 0];
    const printerW = printerWindow ? printerWindow.getBounds().width : 400;
    const spawnRight = printerX + printerW + 16 + existingCount * 24;
    const spawnLeft  = printerX - ticketWidth - 16 + existingCount * 24;
    const defaultX = (spawnRight + ticketWidth <= screenW) ? spawnRight : Math.max(0, spawnLeft);
    const defaultY = Math.max(0, Math.min(printerY + existingCount * 28, screenH - totalHeight - 10));
    const x = Math.max(0, Math.min(ticketData.x ?? defaultX, screenW - ticketWidth));
    const y = Math.max(0, Math.min(ticketData.y ?? defaultY, screenH - 60));

    const win = new BrowserWindow({
        width: ticketWidth,
        height: Math.max(totalHeight, 120),
        x, y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: true,
        resizable: false,
        icon: ICON_PATH,
        webPreferences: {
            preload: path.join(__dirname, 'preload-ticket.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    win.loadFile(path.join(__dirname, 'renderer', 'ticket.html'));
    win.webContents.once('did-finish-load', () => {
        win.webContents.send('ticket:data', ticketData);
    });

    ticketWindows.set(ticketData.id, win);

    win.on('moved', () => {
        if (win.isDestroyed()) return;
        const [wx, wy] = win.getPosition();
        updateTicketInStore(ticketData.id, { x: wx, y: wy });
    });

    win.on('closed', () => ticketWindows.delete(ticketData.id));
    return win;
}

// ── Store Helpers ────────────────────────────────────────
function saveTicketToStore(data) {
    const tickets = store.get('tickets');
    tickets.push(data);
    store.set('tickets', tickets);
}

function updateTicketInStore(id, updates) {
    const tickets = store.get('tickets');
    const idx = tickets.findIndex(t => t.id === id);
    if (idx !== -1) {
        tickets[idx] = { ...tickets[idx], ...updates };
        store.set('tickets', tickets);
    }
}

function removeTicketFromStore(id) {
    store.set('tickets', store.get('tickets').filter(t => t.id !== id));
}

// ── IPC ──────────────────────────────────────────────────

// Printer window requests to start a print job → open paper window
ipcMain.on('printer:print-start', (_event, ticketData) => {
    createPaperWindow(ticketData);
});

// Printer window cancels (ESC) → close paper window, reset printer
ipcMain.on('printer:cancel', () => {
    if (paperWindow && !paperWindow.isDestroyed()) {
        paperWindow.close();
        paperWindow = null;
    }
    if (printerWindow && !printerWindow.isDestroyed()) {
        printerWindow.webContents.send('printer:reset');
    }
});

// Paper window: receipt emerge animation complete → notify printer to show TEAR status
ipcMain.on('paper:ready', () => {
    if (printerWindow && !printerWindow.isDestroyed()) {
        printerWindow.webContents.send('printer:paper-ready');
    }
});

// Paper window: receipt torn → save ticket, spawn ticket window, reset printer
ipcMain.on('paper:torn', (_event, ticketData) => {
    ticketData.id = `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    ticketData.createdAt = new Date().toISOString();
    saveTicketToStore(ticketData);
    createTicketWindow(ticketData);

    if (paperWindow && !paperWindow.isDestroyed()) {
        paperWindow.close();
        paperWindow = null;
    }
    if (printerWindow && !printerWindow.isDestroyed()) {
        printerWindow.webContents.send('printer:reset');
    }
});

// Paper window mouse click-through toggle
ipcMain.on('paper:set-ignore-mouse', (_event, { ignore }) => {
    if (!paperWindow || paperWindow.isDestroyed()) return;
    if (ignore) {
        paperWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
        paperWindow.setIgnoreMouseEvents(false);
    }
});

ipcMain.on('ticket:update-items', (_event, { id, items }) => updateTicketInStore(id, { items }));

ipcMain.on('ticket:discard', (_event, { id }) => {
    removeTicketFromStore(id);
    const win = ticketWindows.get(id);
    if (win && !win.isDestroyed()) win.close();
});

ipcMain.handle('printer:get-tickets', async () => store.get('tickets'));

ipcMain.on('ticket:resize', (_event, { id, width, height }) => {
    const win = ticketWindows.get(id);
    if (win && !win.isDestroyed()) win.setSize(Math.round(width), Math.round(height));
});

ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
});

// ── App Lifecycle ────────────────────────────────────────
app.whenReady().then(() => {
    createPrinterWindow();
    const savedTickets = store.get('tickets') || [];
    for (const ticket of savedTickets) {
        try { createTicketWindow(ticket); }
        catch (err) { console.error('Failed to restore ticket:', ticket.id, err); }
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPrinterWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
