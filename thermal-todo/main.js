const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
    name: 'thermal-todo-data',
    defaults: { tickets: [] },
    clearInvalidConfig: true,
});

let printerWindow = null;
const ticketWindows = new Map();
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');

function createPrinterWindow() {
    printerWindow = new BrowserWindow({
        width: 380,
        height: 1020,           // taller window — more paper zone for long receipts
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

    const defaultX = Math.max(0, Math.min(420 + existingCount * 30, screenW - ticketWidth - 10));
    const defaultY = Math.max(0, Math.min(100 + existingCount * 30, screenH - totalHeight - 10));
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
ipcMain.handle('printer:print-ticket', async (_event, ticketData) => {
    ticketData.id = `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    ticketData.createdAt = new Date().toISOString();
    saveTicketToStore(ticketData);
    createTicketWindow(ticketData);
    return ticketData.id;
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

// ── Click-through fix ────────────────────────────────────
// When the mouse is over a transparent part of the window,
// forward mouse events to whatever is below (desktop, other apps).
// When over the printer body or paper, capture events normally.
ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        // forward:true means mousemove still reaches us even when ignored
        // so we can keep tracking position to toggle back when needed
        win.setIgnoreMouseEvents(ignore, { forward: true });
    }
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
