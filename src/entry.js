import { requirePlasmaAccount } from './plasmaAccount.js';
import { loadMapRuntime } from './mapRuntime.js';

void requirePlasmaAccount().then(async allowed => {
  if (allowed) { await loadMapRuntime(); document.body.removeAttribute('data-auth-pending'); return import('./main.js'); }
}).catch(error => { const status = document.querySelector('.loader-status'); if (status) status.textContent = error.message; });
