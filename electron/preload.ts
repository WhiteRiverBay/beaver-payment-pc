import { contextBridge, ipcRenderer } from 'electron'

// 在这里定义暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electron', {
  // 示例 API
  versions: process.versions,
  send: (channel: string, data: any) => {
    ipcRenderer.send(channel, data)
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.on(channel, func)
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  } 
}) 
