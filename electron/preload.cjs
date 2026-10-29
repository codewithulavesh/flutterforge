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
  onMenuAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
});
