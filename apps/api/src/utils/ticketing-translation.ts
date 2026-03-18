export type TicketingLanguageOption = {
  code: string;
  label: string;
};

const TICKETING_SUPPORTED_LANGUAGES: TicketingLanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ar', label: 'Arabic' },
  { code: 'sw', label: 'Swahili' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ru', label: 'Russian' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ur', label: 'Urdu' },
  { code: 'bn', label: 'Bengali' },
  { code: 'id', label: 'Indonesian' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh-cn', label: 'Chinese (Simplified)' },
  { code: 'zh-tw', label: 'Chinese (Traditional)' },
];

const TICKETING_SUPPORTED_LANGUAGE_SET = new Set(TICKETING_SUPPORTED_LANGUAGES.map((row) => row.code));
const DEFAULT_TRANSLATION_TIMEOUT_MS = 8_000;

const LANGUAGE_ALIASES: Record<string, string> = {
  english: 'en',
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  spanish: 'es',
  es: 'es',
  french: 'fr',
  fr: 'fr',
  portuguese: 'pt',
  pt: 'pt',
  german: 'de',
  de: 'de',
  italian: 'it',
  it: 'it',
  dutch: 'nl',
  nl: 'nl',
  arabic: 'ar',
  ar: 'ar',
  swahili: 'sw',
  sw: 'sw',
  turkish: 'tr',
  tr: 'tr',
  russian: 'ru',
  ru: 'ru',
  hindi: 'hi',
  hi: 'hi',
  urdu: 'ur',
  ur: 'ur',
  bengali: 'bn',
  bn: 'bn',
  indonesian: 'id',
  id: 'id',
  vietnamese: 'vi',
  vi: 'vi',
  japanese: 'ja',
  ja: 'ja',
  korean: 'ko',
  ko: 'ko',
  chinese: 'zh-cn',
  'zh-cn': 'zh-cn',
  'zh-hans': 'zh-cn',
  'zh-simplified': 'zh-cn',
  'zh-tw': 'zh-tw',
  'zh-hant': 'zh-tw',
  'zh-traditional': 'zh-tw',
  'zh-cht': 'zh-tw',
};

const toCanonicalLanguageToken = (value: unknown) => String(value || '').trim().toLowerCase().replace(/_/g, '-');

export const normalizeTicketingLanguage = (value: unknown, fallback = 'en') => {
  const token = toCanonicalLanguageToken(value);
  const fallbackToken = toCanonicalLanguageToken(fallback) || 'en';
  if (!token) return TICKETING_SUPPORTED_LANGUAGE_SET.has(fallbackToken) ? fallbackToken : 'en';
  if (token === 'auto') return 'auto';
  const alias = LANGUAGE_ALIASES[token] || token;
  if (TICKETING_SUPPORTED_LANGUAGE_SET.has(alias)) return alias;
  return TICKETING_SUPPORTED_LANGUAGE_SET.has(fallbackToken) ? fallbackToken : 'en';
};

export const isSupportedTicketingLanguage = (value: unknown) =>
  TICKETING_SUPPORTED_LANGUAGE_SET.has(normalizeTicketingLanguage(value));

export const getTicketingSupportedLanguages = (): TicketingLanguageOption[] => TICKETING_SUPPORTED_LANGUAGES.slice();

export const getTicketingLanguageLabel = (value: unknown) => {
  const token = normalizeTicketingLanguage(value);
  const match = TICKETING_SUPPORTED_LANGUAGES.find((entry) => entry.code === token);
  return match?.label || 'English';
};

type TranslateTicketingTextParams = {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  timeoutMs?: number;
};

type TranslateTicketingTextResult = {
  translatedText: string;
  provider: string;
  detectedLanguage: string;
};

const parseGoogleTranslateResponse = (payload: unknown) => {
  if (!Array.isArray(payload)) return { translatedText: '', detectedLanguage: 'auto' };
  const sentenceRows = Array.isArray(payload[0]) ? payload[0] : [];
  const translatedText = sentenceRows
    .map((row) => (Array.isArray(row) && row[0] !== undefined ? String(row[0] || '') : ''))
    .join('')
    .trim();
  const detectedLanguage = normalizeTicketingLanguage(payload[2], 'auto');
  return {
    translatedText,
    detectedLanguage,
  };
};

export const translateTicketingText = async (
  params: TranslateTicketingTextParams
): Promise<TranslateTicketingTextResult> => {
  const originalText = String(params.text || '');
  const trimmedText = originalText.trim();
  const targetLanguage = normalizeTicketingLanguage(params.targetLanguage, 'en');
  const sourceLanguage = normalizeTicketingLanguage(params.sourceLanguage || 'auto', 'auto');

  if (!trimmedText) {
    return {
      translatedText: '',
      provider: 'identity',
      detectedLanguage: sourceLanguage,
    };
  }
  if (sourceLanguage !== 'auto' && sourceLanguage === targetLanguage) {
    return {
      translatedText: originalText,
      provider: 'identity',
      detectedLanguage: sourceLanguage,
    };
  }

  const timeoutMs = Math.max(1000, Math.min(30_000, Number(params.timeoutMs || DEFAULT_TRANSLATION_TIMEOUT_MS)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = String(process.env.TICKETING_TRANSLATION_ENDPOINT || 'https://translate.googleapis.com/translate_a/single').trim();

  try {
    const url = new URL(endpoint);
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', sourceLanguage === 'auto' ? 'auto' : sourceLanguage);
    url.searchParams.set('tl', targetLanguage);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', originalText);

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });
    if (!response.ok) {
      throw new Error(`translation provider returned ${response.status}`);
    }
    const payload = await response.json().catch(() => null);
    const parsed = parseGoogleTranslateResponse(payload);
    const translatedText = parsed.translatedText || originalText;

    return {
      translatedText,
      provider: 'google-translate-web',
      detectedLanguage: parsed.detectedLanguage || sourceLanguage,
    };
  } finally {
    clearTimeout(timer);
  }
};
