import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Buffer as BufferPolyfill } from 'buffer'

// 使用 polyfill
globalThis.Buffer = BufferPolyfill

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
