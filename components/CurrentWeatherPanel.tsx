'use client';

import React from 'react';
import {
  Droplets,
  Wind,
  Gauge,
  Eye,
  Sunrise,
  Sunset,
  MapPin,
  Sun,
  Moon,
  Navigation,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import WeatherIcon from './WeatherIcon';
import {
  convertTemperature,
  formatCityLocalDateTime,
  formatSunTime,
  getCountryName,
  type CurrentWeatherData,
  type TemperatureUnit,
  type WeatherTheme,
} from '@/lib/weather-utils';

interface CurrentWeatherPanelProps {
  weather: CurrentWeatherData;
  unit: TemperatureUnit;
  isLightTheme: boolean;
  theme?: WeatherTheme;
}

const HALO_COLORS: Record<WeatherTheme, string> = {
  default: 'bg-sky-400/25',
  clear: 'bg-amber-300/35',
  clouds: 'bg-slate-200/25',
  rain: 'bg-sky-400/30',
  snow: 'bg-sky-500/20',
  thunderstorm: 'bg-violet-400/30',
  night: 'bg-indigo-400/30',
};

export default function CurrentWeatherPanel({
  weather,
  unit,
  isLightTheme,
  theme = 'default',
}: CurrentWeatherPanelProps) {
  const condition = weather.weather[0] || {
    id: 800,
    main: 'Clear',
    description: 'clear sky',
    icon: '01d',
  };

  const displayTemp = convertTemperature(weather.main.temp, unit);
  const displayFeelsLike = convertTemperature(weather.main.feels_like, unit);
  const localDateTime = formatCityLocalDateTime(weather.dt, weather.timezone);
  const sunriseTime = weather.sys.sunrise
    ? formatSunTime(weather.sys.sunrise, weather.timezone)
    : '—';
  const sunsetTime = weather.sys.sunset
    ? formatSunTime(weather.sys.sunset, weather.timezone)
    : '—';
  const visibilityKm =
    typeof weather.visibility === 'number'
      ? `${(weather.visibility / 1000).toFixed(1)} km`
      : '—';

  const hasSunCycle =
    weather.sys.sunrise > 0 &&
    weather.sys.sunset > weather.sys.sunrise;
  const isDaytime =
    hasSunCycle &&
    weather.dt >= weather.sys.sunrise &&
    weather.dt <= weather.sys.sunset;
  const daylightRatio = hasSunCycle
    ? Math.max(
        0,
        Math.min(
          1,
          (weather.dt - weather.sys.sunrise) /
            (weather.sys.sunset - weather.sys.sunrise)
        )
      )
    : 0.5;

  const humidityRatio = Math.max(0, Math.min(1, weather.main.humidity / 100));
  const visibilityRatio =
    typeof weather.visibility === 'number'
      ? Math.max(0, Math.min(1, weather.visibility / 10000))
      : 0;
  const pressureRatio = Math.max(
    0,
    Math.min(1, (weather.main.pressure - 970) / 80)
  );

  const titleText = isLightTheme ? 'text-slate-900' : 'text-white';
  const subText = isLightTheme ? 'text-slate-700' : 'text-white/80';
  const mutedText = isLightTheme ? 'text-slate-600' : 'text-white/70';
  const trackBg = isLightTheme ? 'bg-slate-900/12' : 'bg-white/15';
  const dividerBorder = isLightTheme
    ? 'border-slate-900/10'
    : 'border-white/14';

  const metrics = [
    {
      label: 'Humidity',
      value: `${weather.main.humidity}%`,
      icon: Droplets,
      iconTone: isLightTheme ? 'text-sky-700' : 'text-sky-300',
      meterRatio: humidityRatio,
      meterColor: isLightTheme
        ? 'bg-sky-600'
        : 'bg-gradient-to-r from-sky-400 to-cyan-300',
    },
    {
      label: 'Wind Speed',
      value: `${weather.wind.speed.toFixed(1)} m/s`,
      icon: Wind,
      iconTone: isLightTheme ? 'text-teal-700' : 'text-teal-200',
      windDeg: weather.wind.deg,
    },
    {
      label: 'Pressure',
      value: `${weather.main.pressure} hPa`,
      icon: Gauge,
      iconTone: isLightTheme ? 'text-indigo-700' : 'text-indigo-200',
      meterRatio: pressureRatio,
      meterColor: isLightTheme
        ? 'bg-indigo-600'
        : 'bg-gradient-to-r from-indigo-300 to-violet-300',
    },
    {
      label: 'Visibility',
      value: visibilityKm,
      icon: Eye,
      iconTone: isLightTheme ? 'text-cyan-700' : 'text-cyan-200',
      meterRatio: visibilityRatio,
      meterColor: isLightTheme
        ? 'bg-cyan-600'
        : 'bg-gradient-to-r from-cyan-300 to-emerald-300',
    },
    {
      label: 'Sunrise',
      value: sunriseTime,
      icon: Sunrise,
      iconTone: isLightTheme ? 'text-amber-600' : 'text-amber-300',
    },
    {
      label: 'Sunset',
      value: sunsetTime,
      icon: Sunset,
      iconTone: isLightTheme ? 'text-orange-600' : 'text-orange-300',
    },
  ];

  const countryName = getCountryName(weather.sys.country);

  return (
    <motion.section
      key={`${weather.name}-${weather.dt}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Current weather conditions"
      className="space-y-4"
    >
      {/* Main Weather Dashboard Hero */}
      <div className="glass-panel rounded-3xl p-5 sm:p-7 lg:p-8 relative overflow-hidden">
        {/* Soft specular top-right atmospheric glow inside hero */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-60 ${HALO_COLORS[theme]}`}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Location & Local Time */}
          <div className="space-y-2.5 min-w-0">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2.5 flex-wrap"
            >
              <MapPin
                className={`w-5 h-5 shrink-0 ${subText}`}
                aria-hidden="true"
              />
              <h1
                className={`font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance ${titleText}`}
                data-testid="current-city-name"
              >
                {weather.name}
                {countryName ? (
                  <span className={`font-medium ${subText}`}>
                    , {countryName}
                  </span>
                ) : null}
              </h1>
            </motion.div>

            <p
              className={`text-sm sm:text-base font-medium font-mono tabular-nums ${subText}`}
            >
              {localDateTime}
            </p>

            {/* Large Animated Temperature & Feels Like */}
            <div className="pt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div className="overflow-hidden py-0.5">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={`${displayTemp}-${unit}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className={`inline-block font-display text-6xl sm:text-7xl lg:text-[5.25rem] font-extrabold tracking-tight tabular-nums leading-none ${titleText}`}
                    data-testid="current-temperature"
                  >
                    {displayTemp}°{unit}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="space-y-1">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={`feels-${displayFeelsLike}-${unit}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className={`text-sm sm:text-base font-medium tabular-nums ${subText}`}
                    data-testid="feels-like-temperature"
                  >
                    Feels like {displayFeelsLike}°{unit}
                  </motion.p>
                </AnimatePresence>
                <p className={`text-sm capitalize font-medium ${mutedText}`}>
                  {condition.main} · {condition.description}
                </p>
              </div>
            </div>
          </div>

          {/* Large Animated Weather Icon & Condition */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.45,
              delay: 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0"
          >
            <div className="relative flex items-center justify-center">
              <div
                aria-hidden="true"
                className={`absolute inset-1 rounded-full blur-2xl opacity-75 ${HALO_COLORS[theme]}`}
              />
              <div
                className={`relative weather-icon-float rounded-full p-2.5 ${
                  isLightTheme
                    ? 'bg-white/65 border border-sky-900/12 shadow-lg shadow-sky-900/10'
                    : 'bg-white/12 border border-white/20 shadow-xl shadow-black/20'
                }`}
              >
                <WeatherIcon
                  iconCode={condition.icon}
                  alt={condition.description}
                  size={112}
                  className="w-20 h-20 sm:w-28 sm:h-28"
                />
              </div>
            </div>
            <div className="text-left md:text-right">
              <p
                className={`font-display text-xl sm:text-2xl font-semibold ${titleText}`}
              >
                {condition.main}
              </p>
              <p className={`text-sm capitalize ${mutedText}`}>
                {condition.description}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Real Daylight Cycle Progress Bar */}
        {hasSunCycle && (
          <div
            className={`relative z-10 mt-6 pt-4 border-t ${dividerBorder} flex items-center gap-3 sm:gap-4`}
          >
            <div className="flex items-center gap-1.5 shrink-0">
              <Sunrise
                className={`w-4 h-4 ${
                  isLightTheme ? 'text-amber-600' : 'text-amber-300'
                }`}
                aria-hidden="true"
              />
              <span
                className={`font-mono text-xs font-medium tabular-nums ${subText}`}
              >
                {sunriseTime}
              </span>
            </div>

            <div className="relative flex-1 h-1.5 rounded-full overflow-visible">
              <div
                className={`absolute inset-0 rounded-full ${trackBg}`}
              />
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isDaytime ? daylightRatio : 1 }}
                transition={{ duration: 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'left center' }}
                className={`absolute inset-0 rounded-full ${
                  isDaytime
                    ? isLightTheme
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                      : 'bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-300'
                    : isLightTheme
                      ? 'bg-slate-400/60'
                      : 'bg-indigo-300/40'
                }`}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.45 }}
                style={{
                  left: `${(isDaytime ? daylightRatio : 0.98) * 100}%`,
                }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shadow-md ${
                    isDaytime
                      ? 'bg-amber-300 text-amber-950'
                      : 'bg-indigo-200 text-indigo-950'
                  }`}
                >
                  {isDaytime ? (
                    <Sun className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <Moon className="w-3 h-3" aria-hidden="true" />
                  )}
                </div>
              </motion.div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`font-mono text-xs font-medium tabular-nums ${subText}`}
              >
                {sunsetTime}
              </span>
              <Sunset
                className={`w-4 h-4 ${
                  isLightTheme ? 'text-orange-600' : 'text-orange-300'
                }`}
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      </div>

      {/* 6 Weather Information Glass Cards */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4"
        aria-label="Atmospheric details"
      >
        {metrics.map(
          ({ label, value, icon: Icon, iconTone, meterRatio, meterColor, windDeg }, idx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4, scale: 1.015 }}
              transition={{
                duration: 0.32,
                delay: 0.06 + idx * 0.045,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-medium ${mutedText}`}>
                  {label}
                </span>
                <Icon
                  className={`w-4 h-4 shrink-0 ${iconTone}`}
                  aria-hidden="true"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-1.5">
                  <p
                    className={`font-mono text-lg sm:text-xl font-semibold tabular-nums ${titleText}`}
                  >
                    {value}
                  </p>
                  {typeof windDeg === 'number' && (
                    <span
                      title={`Wind direction ${Math.round(windDeg)}°`}
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        isLightTheme ? 'bg-slate-900/8' : 'bg-white/12'
                      }`}
                    >
                      <Navigation
                        className={`w-3 h-3 ${subText}`}
                        style={{ transform: `rotate(${windDeg}deg)` }}
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </div>

                {typeof meterRatio === 'number' && meterColor ? (
                  <div
                    className={`h-1.5 w-full rounded-full overflow-hidden ${trackBg}`}
                    aria-hidden="true"
                  >
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: Math.max(0.06, meterRatio) }}
                      transition={{
                        duration: 0.7,
                        delay: 0.2 + idx * 0.05,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      style={{ transformOrigin: 'left center' }}
                      className={`h-full w-full rounded-full ${meterColor}`}
                    />
                  </div>
                ) : null}
              </div>
            </motion.div>
          )
        )}
      </div>
    </motion.section>
  );
}
