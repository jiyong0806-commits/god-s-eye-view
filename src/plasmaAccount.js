import { createClient } from '@supabase/supabase-js';
import { safeAccountReturn } from '../packages/plasma-account/config.js';

let client, pending;
export async function accountClient() {
  if (client) return client;
  if (pending) return pending;
  pending = (async () => {
    const r = await fetch('/api/account/config', { signal: AbortSignal.timeout(8000) });
    const c = await r.json();
    if (!r.ok || !c.configured || !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(c.url)
      || !String(c.publishableKey).startsWith('sb_publishable_')) throw new Error('계정 서버 연결이 준비되지 않았습니다.');
    client = createClient(c.url, c.publishableKey, { auth: { flowType: 'pkce' } });
    return client;
  })().finally(() => { pending = null; });
  return pending;
}
export async function accountUser() {
  const c = await accountClient(); const { data, error } = await c.auth.getUser();
  if (error?.name === 'AuthSessionMissingError') return null;
  if (error) throw error; return data.user;
}
export function accountRedirect(mode = '') {
  const origin = ['http:', 'https:'].includes(location.protocol) ? location.origin : 'https://godseyeview-c6q.pages.dev';
  return `${origin}/auth/?next=${encodeURIComponent(safeAccountReturn('/map/'))}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}`;
}

export async function requirePlasmaAccount({ getUser = accountUser, current = globalThis.location, listen = true } = {}) {
  let user;
  try { user = await getUser(); } catch { user = null; }
  const next = safeAccountReturn(`${current.pathname}${current.search}${current.hash}`);
  if (!user) { current.replace(`/auth/?next=${encodeURIComponent(next)}`); return false; }
  if (listen) {
    const c = await accountClient();
    c.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) current.replace(`/auth/?next=${encodeURIComponent(next)}`);
    });
  }
  return true;
}
export async function accountProfile() {
  const user = await accountUser(); if (!user) return null;
  const { data, error } = await (await accountClient()).from('plasma_profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw error; return data;
}
export async function saveProfile(profile) {
  const user = await accountUser(); if (!user) throw new Error('로그인이 필요합니다.');
  const consent = profile.personalization_consent === true;
  const row = { user_id: user.id, personalization_consent: consent, updated_at: new Date().toISOString(),
    occupation: consent ? String(profile.occupation || '').slice(0, 80) : '',
    hobbies: consent ? String(profile.hobbies || '').slice(0, 160) : '',
    income_source: consent ? String(profile.income_source || '').slice(0, 80) : '',
    region: consent ? String(profile.region || '').slice(0, 100) : '',
    age_band: consent && ['14-19', '20-29', '30-49', '50+'].includes(profile.age_band) ? profile.age_band : '',
    interests: consent && Array.isArray(profile.interests) ? profile.interests.slice(0, 12).map(x => String(x).slice(0, 40)) : [] };
  const { error } = await (await accountClient()).from('plasma_profiles').upsert(row); if (error) throw error;
  window.dispatchEvent(new CustomEvent('plasma:profile', { detail: row })); return row;
}
export function rankNews(articles, profile) {
  const words = profile?.personalization_consent ? [...(profile.interests || []), profile.occupation, profile.hobbies, profile.region]
    .filter(Boolean).flatMap(value => String(value).split(/[,\s]+/)).filter(word => word.length > 1).slice(0, 30) : [];
  return articles.map(article => {
    const matches = [...new Set(words.filter(word => article.title.toLowerCase().includes(word.toLowerCase())))];
    return { ...article, score: matches.length, recommendationReason: matches.length
      ? `선택한 관심어와 제목 일치: ${matches.join(', ')}` : '최근 경제 뉴스 · 관심어 일치 없음' };
  }).sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt);
}
