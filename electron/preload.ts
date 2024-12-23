import { contextBridge } from 'electron'

// 在这里定义暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 示例 API
  versions: process.versions
}) 