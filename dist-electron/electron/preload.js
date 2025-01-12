"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// 在这里定义暴露给渲染进程的 API
electron_1.contextBridge.exposeInMainWorld('electron', {
    // 示例 API
    versions: process.versions,
    send: (channel, data) => {
        electron_1.ipcRenderer.send(channel, data);
    },
    on: (channel, func) => {
        electron_1.ipcRenderer.on(channel, func);
    },
    removeAllListeners: (channel) => {
        electron_1.ipcRenderer.removeAllListeners(channel);
    }
});
//# sourceMappingURL=preload.js.map