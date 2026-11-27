import { NextRequest, NextResponse } from 'next/server';
import {
  mapWmoToOwm,
  normalizeGoogleWeatherAlerts,
  normalizeNwsAlerts,
  type CurrentWeatherData,
  type ForecastEntry,
  type ForecastResponseData,
  type WeatherAlert,
} from '@/lib/weather-utils';
import { getGoogleMapsApiKey, getOpenWeatherApiKey } from '@/lib/maps-config';

export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromOpenWeatherMap(
  params: { city?: string; lat?: string; lon?: string },
  apiKey: string
): Promise<{ current: CurrentWeatherData; forecast: ForecastResponseData }> {
  const query = params.city
    ? `q=${encodeURIComponent(params.city)}`
    : `lat=${encodeURIComponent(params.lat || '')}&lon=${encodeURIComponent(params.lon || '')}`;

  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?${query}&appid=${encodeURIComponent(apiKey)}&units=metric`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?${query}&appid=${encodeURIComponent(apiKey)}&units=metric`;

  const [currentRes, forecastRes] = await Promise.all([
    fetchWithTimeout(currentUrl),
    fetchWithTimeout(forecastUrl),
  ]);

  if (!currentRes.ok) {
    const errBody = await currentRes.json().catch(() => ({}));
    const status = currentRes.status;
    if (status === 404) {
      throw { status: 404, message: 'City not found. Please check the spelling.' };
    }
    if (status === 401) {
      throw { status: 401, message: 'Invalid OpenWeatherMap API key.' };
    }
    if (status === 429) {
      throw { status: 429, message: 'Weather API rate limit exceeded. Please try again shortly.' };
    }
    throw {
      status,
      message: errBody.message || 'Unable to retrieve weather data from OpenWeatherMap.',
    };
  }

  if (!forecastRes.ok) {
    throw {
      status: forecastRes.status,
      message: 'Unable to retrieve 5-day forecast data.',
    };
  }

  const current: CurrentWeatherData = await currentRes.json();
  const forecast: ForecastResponseData = await forecastRes.json();

  return { current, forecast };
}

interface OpenMeteoGeoResult {
  name: string;
  country_code?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

async function reverseGeocodeCoordinates(
  lat: number,
  lon: number
): Promise<{ name: string; country: string }> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const data = await res.json();
      const city =
        data.city ||
        data.locality ||
        data.principalSubdivision ||
        'Current Location';
      const country = data.countryCode || data.countryName || '';
      return { name: city, country };
    }
  } catch {
    // Fallback below if reverse geocoder is unreachable
  }
  return { name: 'Current Location', country: '' };
}

async function fetchFromLiveOpenMeteo(params: {
  city?: string;
  lat?: string;
  lon?: string;
}): Promise<{ current: CurrentWeatherData; forecast: ForecastResponseData }> {
  let latitude: number;
  let longitude: number;
  let cityName: string;
  let countryCode: string;

  if (params.city) {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      params.city
    )}&count=1&language=en&format=json`;
    const geoRes = await fetchWithTimeout(geoUrl);
    if (!geoRes.ok) {
      throw {
        status: geoRes.status,
        message: 'Unable to reach location geocoding service.',
      };
    }
    const geoData = await geoRes.json();
    const results: OpenMeteoGeoResult[] = geoData.results || [];
    if (results.length === 0) {
      throw { status: 404, message: 'City not found. Please check the spelling.' };
    }
    const top = results[0];
    latitude = top.latitude;
    longitude = top.longitude;
    cityName = top.name;
    countryCode = top.country_code || top.country || '';
  } else {
    latitude = Number(params.lat);
    longitude = Number(params.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw { status: 400, message: 'Valid coordinates are required.' };
    }
    const place = await reverseGeocodeCoordinates(latitude, longitude);
    cityName = place.name;
    countryCode = place.country;
  }

  const meteoUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover` +
    `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,pressure_msl,weather_code,visibility,wind_speed_10m,is_day` +
    `&daily=sunrise,sunset` +
    `&wind_speed_unit=ms` +
    `&timezone=auto` +
    `&timeformat=unixtime` +
    `&forecast_days=6`;

  const meteoRes = await fetchWithTimeout(meteoUrl);
  if (!meteoRes.ok) {
    throw {
      status: meteoRes.status,
      message: 'Live weather service returned an unexpected response.',
    };
  }

  const data = await meteoRes.json();
  if (!data.current || !data.hourly || !data.daily) {
    throw {
      status: 502,
      message: 'Unexpected weather data format received from meteorological service.',
    };
  }

  const tzOffset: number = data.utc_offset_seconds ?? 0;
  const currentDt: number = data.current.time ?? Math.floor(Date.now() / 1000);
  const isDay = Boolean(data.current.is_day);
  const currentCond = mapWmoToOwm(data.current.weather_code ?? 0, isDay);

  // Find current hour visibility from hourly array
  const hourlyTimes: number[] = data.hourly.time || [];
  let currentVisibility = 10000;
  let closestIdx = 0;
  let closestDiff = Infinity;
  for (let i = 0; i < hourlyTimes.length; i++) {
    const diff = Math.abs(hourlyTimes[i] - currentDt);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIdx = i;
    }
  }
  if (
    Array.isArray(data.hourly.visibility) &&
    typeof data.hourly.visibility[closestIdx] === 'number'
  ) {
    currentVisibility = data.hourly.visibility[closestIdx];
  }

  const sunrise: number = data.daily.sunrise?.[0] ?? 0;
  const sunset: number = data.daily.sunset?.[0] ?? 0;

  const current: CurrentWeatherData = {
    name: cityName,
    coord: { lat: latitude, lon: longitude },
    sys: {
      country: countryCode,
      sunrise,
      sunset,
    },
    dt: currentDt,
    timezone: tzOffset,
    main: {
      temp: data.current.temperature_2m,
      feels_like: data.current.apparent_temperature,
      temp_min: data.current.temperature_2m,
      temp_max: data.current.temperature_2m,
      pressure: Math.round(data.current.surface_pressure ?? 1013),
      humidity: Math.round(data.current.relative_humidity_2m ?? 0),
    },
    visibility: Math.round(currentVisibility),
    wind: {
      speed: Number((data.current.wind_speed_10m ?? 0).toFixed(1)),
      deg:
        typeof data.current.wind_direction_10m === 'number'
          ? Math.round(data.current.wind_direction_10m)
          : undefined,
    },
    clouds: {
      all: Math.round(data.current.cloud_cover ?? 0),
    },
    weather: [currentCond],
  };

  // Build 3-hour forecast entries matching OpenWeatherMap /forecast structure
  const forecastList: ForecastEntry[] = [];
  for (let i = 0; i < hourlyTimes.length; i += 3) {
    const dt = hourlyTimes[i];
    if (dt < currentDt - 3600) continue;

    // Look at the 3-hour window [i, i+1, i+2] for genuine window min/max
    const windowTemps: number[] = [];
    for (let j = i; j < Math.min(i + 3, hourlyTimes.length); j++) {
      const t = data.hourly.temperature_2m?.[j];
      if (typeof t === 'number') windowTemps.push(t);
    }
    const temp = data.hourly.temperature_2m?.[i] ?? 0;
    const tempMin = windowTemps.length > 0 ? Math.min(...windowTemps) : temp;
    const tempMax = windowTemps.length > 0 ? Math.max(...windowTemps) : temp;
    const entryIsDay = Boolean(data.hourly.is_day?.[i] ?? 1);
    const cond = mapWmoToOwm(data.hourly.weather_code?.[i] ?? 0, entryIsDay);

    forecastList.push({
      dt,
      main: {
        temp,
        feels_like: data.hourly.apparent_temperature?.[i] ?? temp,
        temp_min: tempMin,
        temp_max: tempMax,
        pressure: Math.round(data.hourly.pressure_msl?.[i] ?? 1013),
        humidity: Math.round(data.hourly.relative_humidity_2m?.[i] ?? 0),
      },
      weather: [cond],
      wind: {
        speed: Number((data.hourly.wind_speed_10m?.[i] ?? 0).toFixed(1)),
      },
    });
  }

  const forecast: ForecastResponseData = {
    city: {
      name: cityName,
      country: countryCode,
      timezone: tzOffset,
    },
    list: forecastList,
  };

  return { current, forecast };
}

/**
 * Fetches real-time severe weather alerts for a coordinate via the
 * Google Maps Platform Weather API (publicAlerts:lookup).
 * Falls back to the official US National Weather Service active alert feed
 * when coordinates are in the US and no Maps Weather alert response is available.
 * Docs: https://developers.google.com/maps/documentation/weather/weather-alerts?utm_campaign=gmp_mcp_codeassist_v1_aistudio
 */
async function fetchRealTimeWeatherAlerts(
  lat: number,
  lon: number,
  countryCode?: string
): Promise<{ alerts: WeatherAlert[]; gmpQuotaExceeded: boolean; alertSource: string }> {
  const mapsApiKey = getGoogleMapsApiKey();

  let gmpQuotaExceeded = false;

  if (mapsApiKey) {
    try {
      const url = new URL('https://weather.googleapis.com/v1/publicAlerts:lookup');
      url.searchParams.set('key', mapsApiKey);
      url.searchParams.set('location.latitude', String(lat));
      url.searchParams.set('location.longitude', String(lon));
      url.searchParams.set('languageCode', 'en');

      const res = await fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: {
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        },
      });

      if (res.status === 429) {
        gmpQuotaExceeded = true;
      } else if (res.ok) {
        const data = await res.json();
        return {
          alerts: normalizeGoogleWeatherAlerts(data),
          gmpQuotaExceeded: false,
          alertSource: 'google-weather-api',
        };
      } else {
        const errPayload = await res.json().catch(() => null);
        if (errPayload?.error?.status === 'RESOURCE_EXHAUSTED') {
          gmpQuotaExceeded = true;
        }
      }
    } catch {
      // Fall through to official NWS endpoint if applicable
    }
  }

  // Secondary official public alert source for US locations (NOAA / NWS)
  const upperCountry = (countryCode || '').toUpperCase();
  const isLikelyUs =
    upperCountry === 'US' ||
    upperCountry === 'USA' ||
    (lat >= 18 && lat <= 72 && lon >= -170 && lon <= -65);

  if (isLikelyUs) {
    try {
      const nwsUrl = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
      const nwsRes = await fetchWithTimeout(nwsUrl, {
        headers: {
          Accept: 'application/geo+json',
          'User-Agent': 'WeatherNowApp/1.0',
        },
      });
      if (nwsRes.ok) {
        const nwsData = await nwsRes.json();
        return {
          alerts: normalizeNwsAlerts(nwsData),
          gmpQuotaExceeded,
          alertSource: 'nws',
        };
      }
    } catch {
      // Non-fatal: return empty alerts list
    }
  }

  return { alerts: [], gmpQuotaExceeded, alertSource: 'none' };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city')?.trim();
  const lat = searchParams.get('lat')?.trim();
  const lon = searchParams.get('lon')?.trim();

  if (!city && (!lat || !lon)) {
    return NextResponse.json(
      { error: 'Please provide a city name or geographic coordinates.' },
      { status: 400 }
    );
  }

  try {
    const owmApiKey = getOpenWeatherApiKey();

    let payload: { current: CurrentWeatherData; forecast: ForecastResponseData };
    let source: 'openweathermap' | 'open-meteo';

    if (owmApiKey) {
      try {
        payload = await fetchFromOpenWeatherMap({ city, lat, lon }, owmApiKey);
        source = 'openweathermap';
      } catch (owmErr: unknown) {
        const owmStatus =
          owmErr && typeof owmErr === 'object' && 'status' in owmErr
            ? Number((owmErr as { status?: number }).status)
            : 500;
        if (owmStatus === 404) {
          throw owmErr;
        }
        payload = await fetchFromLiveOpenMeteo({ city, lat, lon });
        source = 'open-meteo';
      }
    } else {
      payload = await fetchFromLiveOpenMeteo({ city, lat, lon });
      source = 'open-meteo';
    }

    const alertResult = await fetchRealTimeWeatherAlerts(
      payload.current.coord.lat,
      payload.current.coord.lon,
      payload.current.sys.country
    );

    return NextResponse.json({
      ...payload,
      alerts: alertResult.alerts,
      alertSource: alertResult.alertSource,
      gmpQuotaExceeded: alertResult.gmpQuotaExceeded,
      source,
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      const typedErr = err as { status: number; message: string };
      return NextResponse.json(
        { error: typedErr.message },
        { status: typedErr.status || 500 }
      );
    }

    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Weather request timed out. Please check your connection and try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Unable to fetch live weather right now. Please check your internet connection.' },
      { status: 500 }
    );
  }
}
