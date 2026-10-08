import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { requirePlasmaAccount } from '../../src/plasmaAccount.js';

if (location.hash.startsWith('#v=')) location.replace(`/map/${location.search}${location.hash}`);
else void requirePlasmaAccount().then(allowed => { if (allowed) createRoot(document.getElementById('root')).render(<App />); });
