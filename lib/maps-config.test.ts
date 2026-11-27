import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGoogleMapsApiKey,
  getOpenWeatherApiKey,
  isValidGoogleMapsApiKey,
} from './maps-config';

test('isValidGoogleMapsApiKey accepts valid AIza keys and rejects empty/quoted/placeholder strings', () => {
  assert.equal(isValidGoogleMapsApiKey(''), false);
  assert.equal(isValidGoogleMapsApiKey('""'), false);
  assert.equal(isValidGoogleMapsApiKey("''"), false);
  assert.equal(isValidGoogleMapsApiKey('YOUR_GOOGLE_MAPS_KEY'), false);
  assert.equal(isValidGoogleMapsApiKey('MY_KEY_12345678901234567890'), false);
  assert.equal(
    isValidGoogleMapsApiKey('AIzaSyD-ExampleValidKeyFormat123456789'),
    true
  );
  assert.equal(
    isValidGoogleMapsApiKey('"AIzaSyD-QuotedValidKeyFormat123456789"'),
    true
  );
});

test('getGoogleMapsApiKey skips quoted empty env vars and picks the first valid AIza key', () => {
  const prevPlatform = process.env.GOOGLE_MAPS_PLATFORM_API_KEY;
  const prevStd = process.env.GOOGLE_MAPS_API_KEY;
  try {
    process.env.GOOGLE_MAPS_PLATFORM_API_KEY = '""';
    process.env.GOOGLE_MAPS_API_KEY = '"AIzaSyTestKeyValue1234567890abcdefg"';
    assert.equal(
      getGoogleMapsApiKey(),
      'AIzaSyTestKeyValue1234567890abcdefg'
    );
  } finally {
    if (prevPlatform === undefined) delete process.env.GOOGLE_MAPS_PLATFORM_API_KEY;
    else process.env.GOOGLE_MAPS_PLATFORM_API_KEY = prevPlatform;
    if (prevStd === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = prevStd;
  }
});

test('getOpenWeatherApiKey ignores empty quotes and placeholders', () => {
  const prev = process.env.OPENWEATHER_API_KEY;
  try {
    process.env.OPENWEATHER_API_KEY = '""';
    assert.equal(getOpenWeatherApiKey(), '');
    process.env.OPENWEATHER_API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY';
    assert.equal(getOpenWeatherApiKey(), '');
    process.env.OPENWEATHER_API_KEY = '"a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"';
    assert.equal(getOpenWeatherApiKey(), 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6');
  } finally {
    if (prev === undefined) delete process.env.OPENWEATHER_API_KEY;
    else process.env.OPENWEATHER_API_KEY = prev;
  }
});
