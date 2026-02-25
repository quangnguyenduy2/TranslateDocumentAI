import './polyfills'; // Load polyfills FIRST
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Buffer } from 'buffer';

// Aggressive polyfill for Buffer - must run before any imports
(window as any).Buffer = Buffer;
(globalThis as any).Buffer = Buffer;
(window as any).global = window;

// Robust polyfill for Buffer in the browser environment
if (typeof window !== 'undefined') {
  // Fix: Property 'Buffer' does not exist on type 'Window & typeof globalThis'.
  // Ensure Buffer is available globally
  (window as any).Buffer = (window as any).Buffer || Buffer;
  (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
  
  // Explicitly patch isEncoding if missing
  // Fix: Property 'Buffer' does not exist on type 'Window & typeof globalThis'.
  if (typeof (window as any).Buffer.isEncoding !== 'function') {
    // Fix: Property 'Buffer' does not exist on type 'Window & typeof globalThis'.
    (window as any).Buffer.isEncoding = function(encoding: any) {
      const lower = String(encoding).toLowerCase();
      return [
        'hex', 'utf8', 'utf-8', 'ascii', 'latin1', 'binary', 
        'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le'
      ].includes(lower);
    };
  }
  
  // Ensure global object is defined (some older libraries look for it)
  if (typeof (window as any).global === 'undefined') {
    (window as any).global = window;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);