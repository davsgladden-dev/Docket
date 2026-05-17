const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('thermalAPI', {
    printStart:     (data) => ipcRenderer.send('printer:print-start', data),
    cancelPrint:    ()     => ipcRenderer.send('printer:cancel'),
    getTickets:     ()     => ipcRenderer.invoke('printer:get-tickets'),
    minimizeWindow: ()     => ipcRenderer.send('window:minimize'),
    closeWindow:    ()     => ipcRenderer.send('window:close'),
    onReset:        (cb)   => ipcRenderer.on('printer:reset',       () => cb()),
    onPaperReady:   (cb)   => ipcRenderer.on('printer:paper-ready', () => cb()),
});
