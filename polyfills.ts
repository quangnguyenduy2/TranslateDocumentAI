// Polyfills for Node.js APIs in browser environment
// This file MUST be imported first before any other modules

import { Buffer } from 'buffer';

// Make Buffer globally available
(globalThis as any).Buffer = Buffer;
(window as any).Buffer = Buffer;
(window as any).global = globalThis;

// Ensure process.env exists (some libraries expect it)
if (typeof (window as any).process === 'undefined') {
  (window as any).process = {
    env: {},
    version: '',
    versions: {},
    platform: 'browser',
    browser: true
  };
}

console.log('✅ Polyfills loaded: Buffer available');
