function sanitizeEnvValue(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^["']+|["']+$/g, '').trim();
}

/**
 * Validates that a Google Maps Platform API key is a genuine non-placeholder key
 * (Google API keys begin with "AIza" and contain only URL-safe characters).
 */
export function isValidGoogleMapsApiKey(key: string): boolean {
  const cleaned = sanitizeEnvValue(key);
  if (!cleaned) return false;
  if (/^(MY_|YOUR_|REPLACE_|PLACEHOLDER|TEST_)/i.test(cleaned)) return false;
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(cleaned);
}

/**
 * Resolves the Google Maps Platform API key from standard server-side
 * environment variable names provisioned by AI Studio or deployment platforms.
 * Skips empty strings, literal quoted empties (""), and placeholder values so
 * an invalid key is never passed to the Maps JavaScript API.
 */
export function getGoogleMapsApiKey(): string {
  const candidates = [
    process.env.GOOGLE_MAPS_PLATFORM_API_KEY,
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_PLATFORM_API_KEY,
    process.env.GOOGLE_MAPS_API_KEY,
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    process.env.VITE_GOOGLE_MAPS_API_KEY,
    process.env.MAPS_API_KEY,
  ];

  for (const raw of candidates) {
    const cleaned = sanitizeEnvValue(raw);
    if (isValidGoogleMapsApiKey(cleaned)) {
      return cleaned;
    }
  }

  return '';
}

/**
 * Resolves the optional OpenWeatherMap API key while filtering out literal
 * empty quotes ("") or placeholder strings.
 */
export function getOpenWeatherApiKey(): string {
  const cleaned = sanitizeEnvValue(process.env.OPENWEATHER_API_KEY);
  if (!cleaned) return '';
  if (/^(MY_|YOUR_|REPLACE_|PLACEHOLDER)/i.test(cleaned)) return '';
  if (cleaned.length < 16) return '';
  return cleaned;
}
