'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  CloudSun,
  FileDown,
  MapPin,
  X,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import AtmosphericBackdrop from './AtmosphericBackdrop';
import WeatherHeader from './WeatherHeader';
import RecentSearches from './RecentSearches';
import WeatherAlertBanner from './WeatherAlertBanner';
import CurrentWeatherPanel from './CurrentWeatherPanel';
import ForecastGrid from './ForecastGrid';
import WeatherMapPanel from './WeatherMapPanel';
import WeatherScene3D from './WeatherScene3D';
import WeatherIntelPanel from './WeatherIntelPanel';
import {
  RECENT_SEARCHES_KEY,
  UNIT_PREFERENCE_KEY,
  addRecentSearch,
  determineWeatherTheme,
  groupForecastByLocalDate,
  type CurrentWeatherData,
  type DailyForecastSummary,
  type ForecastResponseData,
  type TemperatureUnit,
  type WeatherAlert,
  type WeatherTheme,
} from '@/lib/weather-utils';

const EXPLORE_CITIES = [
  'Tokyo',
  'London',
  'New York',
  'Reykjavik',
  'Sydney',
  'Paris',
];

// Tier 1 Google Maps Platform Demo Key quota listeners (registered once in browser)
let gmpQuotaHooksInstalled = false;
function installGmpQuotaHooks() {
  if (typeof window === 'undefined' || gmpQuotaHooksInstalled) return;
  gmpQuotaHooksInstalled = true;

  let sawInvalidKey = false;
  const win = window as Window & { gm_authFailure?: () => void };
  const prevAuthFailure = win.gm_authFailure;
  win.gm_authFailure = () => {
    prevAuthFailure?.();
    if (sawInvalidKey) {
      window.dispatchEvent(new CustomEvent('gmp-auth-error'));
    } else {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };

  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    const msg = args.map((a) => String(a)).join(' ');
    if (
      msg.includes('OverQuotaMapError') ||
      msg.includes('QuotaExceededError')
    ) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    } else if (
      msg.includes('InvalidKeyMapError') ||
      msg.includes('ApiNotActivatedMapError') ||
      msg.includes('RefererNotAllowedMapError')
    ) {
      sawInvalidKey = true;
      window.dispatchEvent(new CustomEvent('gmp-auth-error'));
    }
  };
}

interface WeatherDashboardProps {
  mapsApiKey?: string;
}

export default function WeatherDashboard({
  mapsApiKey = '',
}: WeatherDashboardProps) {
  const [currentWeather, setCurrentWeather] =
    useState<CurrentWeatherData | null>(null);
  const [forecastDays, setForecastDays] = useState<DailyForecastSummary[]>([]);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>([]);
  const [unit, setUnit] = useState<TemperatureUnit>('C');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [mapsAuthError, setMapsAuthError] = useState(false);
  const [intelRequest, setIntelRequest] = useState<{
    tab: 'search' | 'maps' | null;
    nonce: number;
  }>({ tab: null, nonce: 0 });

  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    installGmpQuotaHooks();
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    const onAuthError = () => setMapsAuthError(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    window.addEventListener('gmp-auth-error', onAuthError);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
      window.removeEventListener('gmp-auth-error', onAuthError);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  }, []);

  const saveRecentCity = useCallback((cityName: string) => {
    setRecentSearches((prev) => {
      const updated = addRecentSearch(prev, cityName);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage quota errors
      }
      return updated;
    });
  }, []);

  const fetchWeather = useCallback(
    async (
      query: { city?: string; lat?: number; lon?: number },
      options: { saveHistory?: boolean } = { saveHistory: true }
    ) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const reqId = ++requestSeqRef.current;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const searchParams = new URLSearchParams();
        if (query.city) {
          searchParams.set('city', query.city);
        } else if (
          typeof query.lat === 'number' &&
          typeof query.lon === 'number'
        ) {
          searchParams.set('lat', String(query.lat));
          searchParams.set('lon', String(query.lon));
        }

        const res = await fetch(`/api/weather?${searchParams.toString()}`, {
          signal: controller.signal,
        });

        const payload = await res.json().catch(() => ({}));

        if (reqId !== requestSeqRef.current) return;

        if (!res.ok) {
          const msg =
            payload.error ||
            (res.status === 404
              ? 'City not found. Please check the spelling.'
              : 'Unable to fetch weather data. Please try again.');
          setErrorMessage(msg);
          showToast(msg);
          return;
        }

        const current: CurrentWeatherData = payload.current;
        const forecast: ForecastResponseData = payload.forecast;
        const alerts: WeatherAlert[] = Array.isArray(payload.alerts)
          ? payload.alerts
          : [];
        const daily = groupForecastByLocalDate(
          forecast.list,
          current.timezone,
          current.dt
        );

        if (payload.gmpQuotaExceeded) {
          setMapsQuotaExceeded(true);
        }

        setCurrentWeather(current);
        setForecastDays(daily);
        setWeatherAlerts(alerts);
        setErrorMessage(null);

        if (options.saveHistory !== false && current.name) {
          saveRecentCity(current.name);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        if (reqId !== requestSeqRef.current) return;
        const msg =
          typeof navigator !== 'undefined' && !navigator.onLine
            ? 'You appear to be offline. Please check your internet connection.'
            : 'Network error while fetching live weather. Please try again.';
        setErrorMessage(msg);
        showToast(msg);
      } finally {
        if (reqId === requestSeqRef.current) {
          setIsLoading(false);
        }
      }
    },
    [saveRecentCity, showToast]
  );

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const savedUnit = localStorage.getItem(UNIT_PREFERENCE_KEY);
        if (savedUnit === 'C' || savedUnit === 'F') {
          setUnit(savedUnit);
        }
        const rawHistory = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory);
          if (Array.isArray(parsed)) {
            const validCities = parsed
              .filter(
                (item): item is string =>
                  typeof item === 'string' && item.trim().length > 0
              )
              .slice(0, 5);
            setRecentSearches(validCities);
            if (validCities.length > 0) {
              fetchWeather({ city: validCities[0] }, { saveHistory: false });
            }
          }
        }
      } catch {
        // Ignore malformed localStorage
      }
    });

    return () => {
      cancelled = true;
      if (abortRef.current) abortRef.current.abort();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [fetchWeather]);

  const handleToggleUnit = useCallback((nextUnit: TemperatureUnit) => {
    setUnit(nextUnit);
    try {
      localStorage.setItem(UNIT_PREFERENCE_KEY, nextUnit);
    } catch {
      // Ignore storage error
    }
  }, []);

  const handleClearHistory = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore storage error
    }
  }, []);

  const handleUseLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser.';
      setErrorMessage(msg);
      showToast(msg);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeather(
          {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
          { saveHistory: true }
        );
      },
      (geoError) => {
        setIsLoading(false);
        let msg = 'Unable to access your current location.';
        if (geoError.code === geoError.PERMISSION_DENIED) {
          msg =
            'Location permission was denied. Please enable location access or search for a city manually.';
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          msg = 'Location information is unavailable right now.';
        } else if (geoError.code === geoError.TIMEOUT) {
          msg = 'Location request timed out. Please try again.';
        }
        setErrorMessage(msg);
        showToast(msg);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [fetchWeather, showToast]);

  const jumpToGroundedIntel = useCallback((tab: 'search' | 'maps') => {
    setIntelRequest((prev) => ({ tab, nonce: prev.nonce + 1 }));
    if (typeof document !== 'undefined') {
      document
        .getElementById('weather-intel-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const theme: WeatherTheme = currentWeather
    ? determineWeatherTheme(
        currentWeather.weather[0]?.main || 'Clear',
        currentWeather.dt,
        currentWeather.sys.sunrise,
        currentWeather.sys.sunset,
        currentWeather.weather[0]?.icon
      )
    : 'default';

  const isLightTheme = theme === 'snow';
  const titleText = isLightTheme ? 'text-slate-900' : 'text-white';
  const subText = isLightTheme ? 'text-slate-700' : 'text-white/80';
  const skeletonFill = isLightTheme ? 'bg-slate-900/10' : 'bg-white/12';

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`weather-bg theme-${theme} flex flex-col`}
        data-theme={theme}
      >
        <AtmosphericBackdrop theme={theme} />

        {/* Google Maps Platform Demo Key Quota Warning Banner (persists at root level) */}
        {mapsQuotaExceeded ? (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner,
              visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        ) : null}

        <WeatherHeader
          onSearch={(city) => fetchWeather({ city })}
          onUseLocation={handleUseLocation}
          unit={unit}
          onToggleUnit={handleToggleUnit}
          isLoading={isLoading}
          isLightTheme={isLightTheme}
        />

        <RecentSearches
          searches={recentSearches}
          activeCity={currentWeather?.name}
          onSelectCity={(city) => fetchWeather({ city })}
          onClearHistory={handleClearHistory}
          isLightTheme={isLightTheme}
        />

        <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 space-y-5">
          {/* Real-Time Severe Weather Alert Banner (top of dashboard when active alerts exist) */}
          {!isLoading && currentWeather && weatherAlerts.length > 0 ? (
            <WeatherAlertBanner
              key={`${currentWeather.name}-${weatherAlerts.map((a) => a.alertId).join('|')}`}
              alerts={weatherAlerts}
              timezoneOffsetSeconds={currentWeather.timezone}
              onInspectBriefing={() => jumpToGroundedIntel('search')}
              onFindShelters={() => jumpToGroundedIntel('maps')}
            />
          ) : null}

          {/* Animated Inline Error Banner */}
          <AnimatePresence>
            {errorMessage ? (
              <motion.div
                key="error-banner"
                role="alert"
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={`rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 border ${
                  isLightTheme
                    ? 'bg-red-50/92 border-red-300 text-red-900 shadow-sm'
                    : 'bg-red-950/65 border-red-400/35 text-red-50 backdrop-blur-md shadow-lg'
                }`}
                data-testid="error-banner"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle
                    className="w-5 h-5 shrink-0 text-red-400"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium">{errorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  aria-label="Dismiss error"
                  className="p-1 rounded-lg hover:bg-white/10 cursor-pointer shrink-0 transition-colors"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Animated Atmospheric Loading State + Skeleton Layout */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading-state"
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
                data-testid="loading-indicator"
              >
                <div className="glass-panel rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="relative flex items-center justify-center w-16 h-16">
                    <span
                      aria-hidden="true"
                      className={`radar-ping absolute inset-0 rounded-full border-2 ${
                        isLightTheme ? 'border-sky-600/50' : 'border-sky-300/60'
                      }`}
                    />
                    <span
                      aria-hidden="true"
                      className={`radar-ping absolute inset-0 rounded-full border-2 ${
                        isLightTheme ? 'border-sky-500/40' : 'border-white/40'
                      }`}
                      style={{ animationDelay: '0.75s' }}
                    />
                    <div
                      className={`relative w-12 h-12 rounded-2xl flex items-center justify-center ${
                        isLightTheme
                          ? 'bg-sky-600 text-white'
                          : 'bg-white/15 text-amber-300 border border-white/20'
                      }`}
                    >
                      <CloudSun className="w-6 h-6" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p
                      className={`font-display text-lg sm:text-xl font-semibold ${titleText}`}
                    >
                      Fetching live weather...
                    </p>
                    <p className={`text-sm ${subText}`}>
                      Retrieving real-time conditions, severe alerts, and 5-day
                      forecast
                    </p>
                  </div>
                </div>

                {/* Shimmering atmospheric metric skeletons */}
                <div
                  aria-hidden="true"
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4"
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="glass-card rounded-2xl p-4 sm:p-5 space-y-3"
                    >
                      <div
                        className={`h-3 w-16 rounded-md shimmer-bar ${skeletonFill}`}
                      />
                      <div
                        className={`h-6 w-20 rounded-md shimmer-bar ${skeletonFill}`}
                      />
                      <div
                        className={`h-1.5 w-full rounded-full shimmer-bar ${skeletonFill}`}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : currentWeather ? (
              <motion.div
                key={`dashboard-${currentWeather.name}-${currentWeather.dt}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <CurrentWeatherPanel
                  weather={currentWeather}
                  unit={unit}
                  isLightTheme={isLightTheme}
                  theme={theme}
                />

                <ForecastGrid
                  days={forecastDays}
                  unit={unit}
                  isLightTheme={isLightTheme}
                />

                {/* Interactive Google Map + Three.js 3D Observatory */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                  <WeatherMapPanel
                    apiKey={mapsApiKey}
                    weather={currentWeather}
                    alerts={weatherAlerts}
                    unit={unit}
                    isLightTheme={isLightTheme}
                    mapsAuthError={mapsAuthError}
                    onSelectLocation={(lat, lon) =>
                      fetchWeather({ lat, lon }, { saveHistory: true })
                    }
                  />
                  <WeatherScene3D
                    weather={currentWeather}
                    theme={theme}
                    isLightTheme={isLightTheme}
                  />
                </div>

                {/* Gemini 4 Hydrogen Search & Maps Grounding Panel */}
                <WeatherIntelPanel
                  key={`${currentWeather.name}-${currentWeather.coord.lat.toFixed(2)}-${currentWeather.coord.lon.toFixed(2)}`}
                  weather={currentWeather}
                  alerts={weatherAlerts}
                  isLightTheme={isLightTheme}
                  requestedTab={intelRequest.tab}
                  requestedNonce={intelRequest.nonce}
                />
              </motion.div>
            ) : (
              <motion.section
                key="empty-state"
                aria-label="Welcome"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="glass-panel rounded-3xl p-8 sm:p-12 text-center max-w-3xl mx-auto mt-4 sm:mt-8 space-y-7 relative overflow-hidden"
                data-testid="empty-state"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-56 rounded-full bg-sky-400/20 blur-3xl"
                />

                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="relative z-10 w-20 h-20 rounded-3xl bg-white/14 border border-white/22 shadow-xl shadow-black/20 flex items-center justify-center mx-auto weather-icon-float"
                >
                  <CloudSun
                    className="w-10 h-10 text-amber-300"
                    aria-hidden="true"
                  />
                </motion.div>

                <div className="relative z-10 space-y-3 max-w-xl mx-auto">
                  <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
                    Live Global Weather, Wherever You Look
                  </h1>
                  <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                    Search any city worldwide or use your current location to
                    view real-time temperatures, severe weather alerts,
                    interactive Google Maps overlays, and a live 3D observatory.
                  </p>
                </div>

                <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.16 }}
                    onClick={handleUseLocation}
                    className="h-11 px-6 rounded-xl bg-white text-slate-900 hover:bg-white/95 shadow-lg shadow-black/20 text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    <span>Use My Location</span>
                  </motion.button>
                </div>

                <div className="relative z-10 pt-5 border-t border-white/15 space-y-3">
                  <p className="text-xs font-medium text-white/70">
                    Or explore live weather in major cities
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    {EXPLORE_CITIES.map((city, idx) => (
                      <motion.button
                        key={city}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.18 + idx * 0.045,
                          duration: 0.28,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        whileHover={{ y: -2, scale: 1.03 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => fetchWeather({ city })}
                        className="group h-9 px-4 rounded-xl bg-white/12 hover:bg-white/22 border border-white/20 text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        <span>{city}</span>
                        <ArrowUpRight
                          className="w-3.5 h-3.5 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        <footer className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p
            className={`text-xs ${
              isLightTheme ? 'text-slate-700/80' : 'text-white/65'
            }`}
          >
            WeatherNow · Live meteorological telemetry, alerts &amp;{' '}
            <a
              href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:opacity-100"
            >
              Google Maps Terms
            </a>
          </p>
          <a
            href="/WeatherNow_Project_Documentation.pdf"
            download="WeatherNow_Project_Documentation.pdf"
            className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 underline-offset-4 hover:underline ${
              isLightTheme
                ? 'text-slate-800 hover:text-slate-950'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <FileDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Download Documentation (PDF)</span>
          </a>
        </footer>

        {/* Animated Toast Notification for Errors */}
        <AnimatePresence>
          {toastMessage ? (
            <motion.div
              key="error-toast"
              role="status"
              aria-live="assertive"
              initial={{ opacity: 0, y: 20, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl bg-slate-900/95 text-white border border-white/15 shadow-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md"
              data-testid="error-toast"
            >
              <AlertCircle
                className="w-4 h-4 text-red-400 shrink-0"
                aria-hidden="true"
              />
              <p className="text-xs sm:text-sm font-medium flex-1">
                {toastMessage}
              </p>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                aria-label="Close notification"
                className="p-1 rounded-lg hover:bg-white/10 cursor-pointer shrink-0 transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
