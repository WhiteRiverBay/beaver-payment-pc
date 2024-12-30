"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  // 示例 API
  versions: process.versions,
  send: (channel, data) => {
    electron.ipcRenderer.send(channel, data);
  },
  on: (channel, func) => {
    electron.ipcRenderer.on(channel, func);
  },
  removeAllListeners: (channel) => {
    electron.ipcRenderer.removeAllListeners(channel);
  }
});
