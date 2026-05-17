const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('paperAPI', {
    onData:               (cb) => ipcRenderer.on('paper:data',   (_e, data) => cb(data)),
    torn:                 (data) => ipcRenderer.send('paper:torn', data),
    paperReady:           ()     => ipcRenderer.send('paper:ready'),
    setIgnoreMouseEvents: (ignore) => ipcRenderer.send('paper:set-ignore-mouse', { ignore }),
});
