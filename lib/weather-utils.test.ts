import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertTemperature,
  groupForecastByLocalDate,
  determineWeatherTheme,
  addRecentSearch,
  formatCityLocalDateTime,
  formatSunTime,
  mapWmoToOwm,
  getCountryName,
  normalizeGoogleWeatherAlerts,
  normalizeNwsAlerts,
  parseAlertPolygonRings,
  formatAlertTimeRange,
  type ForecastEntry,
} from './weather-utils';

test('convertTemperature converts Celsius to Fahrenheit accurately using F = (C * 9/5) + 32', () => {
  assert.equal(convertTemperature(0, 'C'), 0);
  assert.equal(convertTemperature(0, 'F'), 32);
  assert.equal(convertTemperature(100, 'F'), 212);
  assert.equal(convertTemperature(20, 'F'), 68);
  assert.equal(convertTemperature(-40, 'F'), -40);
  assert.equal(convertTemperature(21.4, 'C'), 21);
});

test('groupForecastByLocalDate aggregates 3-hour entries by local calendar date with genuine highs and lows', () => {
  // Timezone UTC+9 (32400s). Base date: 2026-11-18 00:00 UTC -> 2026-11-18 09:00 JST
  const tz = 32400;
  const baseDt = Math.floor(Date.UTC(2026, 10, 18, 0, 0, 0) / 1000);

  const entries: ForecastEntry[] = [
    // Today (Nov 18)
    {
      dt: baseDt + 3600 * 3,
      main: { temp: 12, feels_like: 10, temp_min: 11, temp_max: 13, pressure: 1015, humidity: 60 },
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
      wind: { speed: 3 },
    },
    // Day 1: Nov 19
    {
      dt: baseDt + 86400 * 1,
      main: { temp: 10, feels_like: 9, temp_min: 8, temp_max: 11, pressure: 1016, humidity: 62 },
      weather: [{ id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }],
      wind: { speed: 2.5 },
    },
    {
      dt: baseDt + 86400 * 1 + 3600 * 3,
      main: { temp: 18, feels_like: 17, temp_min: 16, temp_max: 19, pressure: 1014, humidity: 50 },
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
      wind: { speed: 3.1 },
    },
    // Day 2: Nov 20
    {
      dt: baseDt + 86400 * 2 + 3600 * 3,
      main: { temp: 14, feels_like: 13, temp_min: 12, temp_max: 15, pressure: 1010, humidity: 80 },
      weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10d' }],
      wind: { speed: 5.0 },
    },
    // Day 3: Nov 21
    {
      dt: baseDt + 86400 * 3 + 3600 * 3,
      main: { temp: 9, feels_like: 7, temp_min: 6, temp_max: 11, pressure: 1018, humidity: 55 },
      weather: [{ id: 803, main: 'Clouds', description: 'broken clouds', icon: '04d' }],
      wind: { speed: 4.0 },
    },
    // Day 4: Nov 22
    {
      dt: baseDt + 86400 * 4 + 3600 * 3,
      main: { temp: 16, feels_like: 15, temp_min: 11, temp_max: 17, pressure: 1020, humidity: 48 },
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
      wind: { speed: 2.2 },
    },
    // Day 5: Nov 23
    {
      dt: baseDt + 86400 * 5 + 3600 * 3,
      main: { temp: 13, feels_like: 12, temp_min: 9, temp_max: 14, pressure: 1019, humidity: 52 },
      weather: [{ id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }],
      wind: { speed: 2.8 },
    },
  ];

  const grouped = groupForecastByLocalDate(entries, tz, baseDt);
  assert.equal(grouped.length, 5);
  assert.equal(grouped[0].dateKey, '2026-11-19');
  assert.equal(grouped[0].tempMaxC, 19);
  assert.equal(grouped[0].tempMinC, 8);
  assert.equal(grouped[1].condition, 'Rain');
  assert.equal(grouped[4].dateKey, '2026-11-23');
});

test('determineWeatherTheme maps weather conditions and day/night status properly', () => {
  const sunrise = 1000;
  const sunset = 2000;

  assert.equal(determineWeatherTheme('Clear', 1500, sunrise, sunset), 'clear');
  assert.equal(determineWeatherTheme('Clear', 2500, sunrise, sunset), 'night');
  assert.equal(determineWeatherTheme('Clouds', 1500, sunrise, sunset), 'clouds');
  assert.equal(determineWeatherTheme('Clouds', 500, sunrise, sunset), 'night');
  assert.equal(determineWeatherTheme('Rain', 1500, sunrise, sunset), 'rain');
  assert.equal(determineWeatherTheme('Snow', 1500, sunrise, sunset), 'snow');
  assert.equal(determineWeatherTheme('Thunderstorm', 2500, sunrise, sunset), 'thunderstorm');
});

test('addRecentSearch deduplicates case-insensitively, puts latest first, and caps at 5', () => {
  let list: string[] = [];
  list = addRecentSearch(list, 'Tokyo');
  list = addRecentSearch(list, 'London');
  list = addRecentSearch(list, 'Paris');
  list = addRecentSearch(list, 'Cairo');
  list = addRecentSearch(list, 'Lima');
  assert.deepEqual(list, ['Lima', 'Cairo', 'Paris', 'London', 'Tokyo']);

  list = addRecentSearch(list, 'london');
  assert.deepEqual(list, ['london', 'Lima', 'Cairo', 'Paris', 'Tokyo']);

  list = addRecentSearch(list, 'Oslo');
  assert.deepEqual(list, ['Oslo', 'london', 'Lima', 'Cairo', 'Paris']);
});

test('formatCityLocalDateTime and formatSunTime respect city timezone offset', () => {
  const dt = Math.floor(Date.UTC(2026, 10, 18, 12, 0, 0) / 1000);
  const formatted = formatCityLocalDateTime(dt, 32400); // +9h => 9:00 PM
  assert.match(formatted, /9:00 PM/);
  assert.match(formatted, /Nov 18, 2026/);

  const sunFormatted = formatSunTime(dt, -18000); // -5h => 7:00 AM
  assert.match(sunFormatted, /7:00 AM/);
});

test('mapWmoToOwm produces valid OpenWeatherMap condition metadata and icon codes', () => {
  const clearDay = mapWmoToOwm(0, true);
  assert.equal(clearDay.main, 'Clear');
  assert.equal(clearDay.icon, '01d');

  const clearNight = mapWmoToOwm(0, false);
  assert.equal(clearNight.icon, '01n');

  const storm = mapWmoToOwm(95, true);
  assert.equal(storm.main, 'Thunderstorm');
  assert.equal(storm.icon, '11d');
});

test('getCountryName converts ISO country codes into readable country names', () => {
  assert.equal(getCountryName('JP'), 'Japan');
  assert.equal(getCountryName('GB'), 'United Kingdom');
  assert.equal(getCountryName('IS'), 'Iceland');
  assert.equal(getCountryName(''), '');
});

test('normalizeGoogleWeatherAlerts sorts alerts by severity and preserves agency attribution', () => {
  const payload = {
    regionCode: 'US',
    weatherAlerts: [
      {
        alertId: 'a-mod',
        alertTitle: { text: 'Heat Advisory', languageCode: 'en' },
        eventType: 'HEAT',
        areaName: 'Phoenix Metro',
        severity: 'MODERATE',
        urgency: 'EXPECTED',
        dataSource: {
          publisher: 'NOAA',
          name: 'National Weather Service',
          authorityUri: 'https://www.weather.gov/',
        },
      },
      {
        alertId: 'a-ext',
        alertTitle: { text: 'Flash Flood Warning', languageCode: 'en' },
        eventType: 'FLASH_FLOOD',
        areaName: 'Wake County, NC',
        severity: 'EXTREME',
        urgency: 'IMMEDIATE',
        instruction: ['Move immediately to higher ground.'],
        dataSource: {
          publisher: 'NOAA',
          name: 'National Weather Service',
          authorityUri: 'https://www.weather.gov/',
        },
      },
    ],
  };

  const alerts = normalizeGoogleWeatherAlerts(payload);
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].title, 'Flash Flood Warning');
  assert.equal(alerts[0].severity, 'EXTREME');
  assert.equal(alerts[0].dataSource.name, 'National Weather Service');
  assert.equal(alerts[0].dataSource.authorityUri, 'https://www.weather.gov/');
  assert.equal(alerts[1].title, 'Heat Advisory');

  assert.deepEqual(normalizeGoogleWeatherAlerts({ regionCode: 'US' }), []);
});

test('normalizeNwsAlerts extracts NWS severe warnings and GeoJSON polygons', () => {
  const nwsPayload = {
    features: [
      {
        id: 'nws-1',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-78.45, 35.82], [-78.41, 35.73], [-78.28, 35.66], [-78.45, 35.82]]],
        },
        properties: {
          event: 'Severe Thunderstorm Warning',
          areaDesc: 'Wake, NC',
          severity: 'Severe',
          urgency: 'Immediate',
          senderName: 'NWS Raleigh NC',
          instruction: 'Seek shelter indoors immediately.',
        },
      },
    ],
  };

  const alerts = normalizeNwsAlerts(nwsPayload);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].severity, 'SEVERE');
  assert.equal(alerts[0].dataSource.name, 'NWS Raleigh NC');
  const rings = parseAlertPolygonRings(alerts[0].polygon);
  assert.equal(rings.length, 1);
  assert.equal(rings[0].length, 4);
  assert.deepEqual(rings[0][0], { lat: 35.82, lng: -78.45 });
});

test('formatAlertTimeRange formats ISO alert start and expiration times in local offset', () => {
  const range = formatAlertTimeRange(
    '2025-08-06T18:24:00Z',
    '2025-08-06T21:30:00Z',
    -14400 // UTC-4
  );
  assert.match(range, /2:24 PM/);
  assert.match(range, /5:30 PM/);
});

