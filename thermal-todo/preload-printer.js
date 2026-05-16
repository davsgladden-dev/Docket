const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('thermalAPI', {
    printTicket:          (data)          => ipcRenderer.invoke('printer:print-ticket', data),
    getTickets:           ()              => ipcRenderer.invoke('printer:get-tickets'),
    minimizeWindow:       ()              => ipcRenderer.send('window:minimize'),
    closeWindow:          ()              => ipcRenderer.send('window:close'),
    // Click-through: pass true to let clicks fall through to desktop/other apps
    setIgnoreMouseEvents: (ignore)        => ipcRenderer.send('set-ignore-mouse-events', ignore),
});
