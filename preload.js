const { contextBridge, ipcRenderer } = require('electron');
const marked = require('marked');

contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    sendSync: (channel, data) => ipcRenderer.sendSync(channel, data),
});

contextBridge.exposeInMainWorld('markedAPI', {
    parse: marked.parse
}); 