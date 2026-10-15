const env = require('../../../config/env');
const { ApiError } = require('../../utils/httpResponse');

// Groq reads the format from the file name, so it has to match the audio
const EXTENSIONS = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
};

/**
 * Speech to text through Groq's Whisper. The audio stays in memory for the
 * request and is never stored. Returns the transcript ('' if nothing was said).
 * `language` is an ISO code to pin, '' lets Whisper detect it, undefined uses the env default
 */
async function transcribeAudio({ buffer, mimetype, language }) {
  const { apiKey, baseUrl, transcribeModel, transcribeLanguage, transcribeTimeoutMs } = env.ai.groq;
  if (!apiKey) {
    throw new ApiError(503, "Voice input isn't available right now.", { code: 'VOICE_UNAVAILABLE' });
  }

  const type = mimetype.split(';')[0];
  const form = new FormData();
  form.append('file', new Blob([buffer], { type }), `voice.${EXTENSIONS[type] || 'm4a'}`);
  form.append('model', transcribeModel);
  const lang = language === undefined ? transcribeLanguage : language;
  if (lang) form.append('language', lang);
  form.append('temperature', '0');

  let response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(transcribeTimeoutMs),
    });
  } catch {
    throw new ApiError(503, "Couldn't reach the voice service. Try again.", { code: 'VOICE_UNAVAILABLE' });
  }

  // Free tier: a 429 means the shared limit is used up for now
  if (response.status === 429) {
    throw ApiError.tooManyRequests('Voice is busy right now. Try again in a moment.');
  }
  if (!response.ok) {
    throw new ApiError(503, "Couldn't turn that into text. Try again.", { code: 'VOICE_UNAVAILABLE' });
  }

  const data = await response.json();
  return (data.text || '').trim();
}

module.exports = { transcribeAudio };