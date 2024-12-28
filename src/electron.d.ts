declare global {
  interface Window {
    electron: any;
  }
}

import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

export {}; 