import { sendJson } from '../_utils.js';

const DAILY_LIMIT = 50;
const dailyUsage = new Map();

function takeDailyQuota(request) {
  const day = new Date().toISOString().slice(0, 10);
  const forwarded = String(request.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const client = forwarded || request.socket?.remoteAddress || 'unknown';
  const key = `${day}:${client}`;
  const used = dailyUsage.get(key) || 0;
  if (used >= DAILY_LIMIT) return false;
  dailyUsage.set(key, used + 1);
  if (dailyUsage.size > 5000) {
    for (const storedKey of dailyUsage.keys()) {
      if (!storedKey.startsWith(`${day}:`)) dailyUsage.delete(storedKey);
    }
  }
  return true;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'method-not-allowed' });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return sendJson(response, 503, { error: 'ElevenLabs TTS is not configured' });
  if (!takeDailyQuota(request)) return sendJson(response, 429, { error: 'daily-voice-limit-reached' });
  const text = String(request.body?.text || '').trim().slice(0, 900);
  if (!text) return sendJson(response, 400, { error: 'Text is required' });
  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey, Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        language_code: request.body?.language === 'ko' ? 'ko' : undefined,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.18, use_speaker_boost: true },
      }),
    });
    if (!upstream.ok) return sendJson(response, upstream.status, { error: 'ElevenLabs request failed' });
    response.setHeader('Content-Type', 'audio/mpeg');
    response.setHeader('Cache-Control', 'private, no-store');
    response.statusCode = 200;
    return response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return sendJson(response, 502, { error: 'ElevenLabs is temporarily unavailable' });
  }
}
