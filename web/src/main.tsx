import React from 'react';
import { createRoot } from 'react-dom/client';
import AuthApp from './auth-app';
import { migrateLegacyHistory } from './legacy-migration';
import './globals.css';

try { migrateLegacyHistory(localStorage); } catch { /* Original history stays untouched if storage is unavailable. */ }
createRoot(document.getElementById('root')!).render(<AuthApp />);
