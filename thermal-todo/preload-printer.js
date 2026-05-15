// preload-printer.js
// This runs BEFORE the renderer page loads.
// It exposes a safe, limited API to the renderer via contextBridge.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('thermalAPI', {
    // Send a new ticket to be created
    printTicket: (ticketData) => ipcRenderer.invoke('printer:print-ticket', ticketData),

    // Get all existing tickets (for UI state if needed)
    getTickets: () => ipcRenderer.invoke('printer:get-tickets'),

    // Window controls (since we removed the frame)
    minimizeWindow: () => ipcRenderer.send('window:minimize'),
    closeWindow: () => ipcRenderer.send('window:close')
});