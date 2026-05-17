// preload-ticket.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ticketAPI', {
    // Receive ticket data when window loads
    onTicketData: (callback) => {
        ipcRenderer.on('ticket:data', (event, data) => callback(data));
    },

    // Tell main process items were updated
    updateItems: (id, items) => ipcRenderer.send('ticket:update-items', { id, items }),

    // Tell main process to discard this ticket
    discard: (id) => ipcRenderer.send('ticket:discard', { id }),

    // Request window resize
    resize: (id, width, height) => ipcRenderer.send('ticket:resize', { id, width, height })
});