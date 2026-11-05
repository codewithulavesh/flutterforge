'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Minimal, explicitly enumerated desktop bridge. The renderer never receives
 * `ipcRenderer` itself, and every channel is a fixed main-process handler.
 */
contextBridge.exposeInMainWorld('flutterforgeDesktop', {
  isDesktop: true,
  platform: process.platform,
  arch: process.arch,
  getInfo: () => ipcRenderer.invoke('desktop:info'),
  pickFolder: () => ipcRenderer.invoke('desktop:pick-folder'),
  openPath: (target) => ipcRenderer.invoke('desktop:open-path', target),
  showItemInFolder: (target) => ipcRenderer.invoke('desktop:show-item', target),
  harnessHealth: () => ipcRenderer.invoke('desktop:harness-health'),
  vault: {
    status: () => ipcRenderer.invoke('vault:status'),
    setKey: (provider, key) => ipcRenderer.invoke('vault:set-key', provider, key),
    removeKey: (provider) => ipcRenderer.invoke('vault:remove-key', provider),
  },
  qa: {
    capture: (payload) => ipcRenderer.invoke('qa:capture', payload),
  },
  onMenuAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
});
