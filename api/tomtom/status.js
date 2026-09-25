import { methodGuard, sendJson } from '../_utils.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  const hasKey = Boolean(String(process.env.TOMTOM_API_KEY || process.env.VITE_TOMTOM_API_KEY || '').trim());
  sendJson(res, 200, {
    hasKey,
    dailyCount: 0,
    budget: Number(process.env.TOMTOM_DAILY_BUDGET || 500),
    source: 'server',
  }, {
    'cache-control': 's-maxage=30',
  });
}
