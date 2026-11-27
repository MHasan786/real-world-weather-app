'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import WeatherIcon from './WeatherIcon';
import {
  convertTemperature,
  type DailyForecastSummary,
  type TemperatureUnit,
} from '@/lib/weather-utils';

interface ForecastGridProps {
  days: DailyForecastSummary[];
  unit: TemperatureUnit;
  isLightTheme: boolean;
}

export default function ForecastGrid({
  days,
  unit,
  isLightTheme,
}: ForecastGridProps) {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  if (days.length === 0) return null;

  const weekMinC = Math.min(...days.map((d) => d.tempMinC));
  const weekMaxC = Math.max(...days.map((d) => d.tempMaxC));
  const weekSpan = Math.max(weekMaxC - weekMinC, 1);

  const titleText = isLightTheme ? 'text-slate-900' : 'text-white';
  const subText = isLightTheme ? 'text-slate-700' : 'text-white/80';
  const mutedText = isLightTheme ? 'text-slate-600' : 'text-white/65';
  const trackBg = isLightTheme ? 'bg-slate-900/12' : 'bg-white/15';
  const activeBorder = isLightTheme
    ? 'border-slate-900/55 bg-white/25'
    : 'border-white/70 bg-white/10';

  const selectedDay = days.find((d) => d.dateKey === selectedDateKey) || null;
  const forecastKey = days.map((d) => d.dateKey).join('-');

  return (
    <section aria-label="5-Day Weather Forecast" className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          className={`font-display text-xl sm:text-2xl font-bold tracking-tight ${titleText}`}
        >
          5-Day Forecast
        </h2>
        <span className={`text-xs sm:text-sm font-medium ${mutedText}`}>
          Daily highs &amp; lows · Click a day for range details
        </span>
      </div>

      <div
        key={forecastKey}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4"
        data-testid="forecast-grid"
      >
        {days.map((day, idx) => {
          const maxTemp = convertTemperature(day.tempMaxC, unit);
          const minTemp = convertTemperature(day.tempMinC, unit);
          const isSelected = selectedDateKey === day.dateKey;

          const startPct = ((day.tempMinC - weekMinC) / weekSpan) * 100;
          const widthPct = Math.max(
            14,
            ((day.tempMaxC - day.tempMinC) / weekSpan) * 100
          );

          return (
            <motion.button
              key={day.dateKey}
              type="button"
              onClick={() =>
                setSelectedDateKey((prev) =>
                  prev === day.dateKey ? null : day.dateKey
                )
              }
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5, scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{
                duration: 0.34,
                delay: idx * 0.055,
                ease: [0.16, 1, 0.3, 1],
              }}
              aria-pressed={isSelected}
              className="relative glass-card rounded-2xl p-4 sm:p-5 text-left flex sm:flex-col items-center sm:items-stretch justify-between gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 group"
              data-testid="forecast-card"
            >
              {/* Animated sliding selection highlight */}
              {isSelected && (
                <motion.span
                  layoutId="forecast-active-ring"
                  transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                  className={`pointer-events-none absolute inset-0 rounded-2xl border-2 ${activeBorder}`}
                />
              )}

              {/* Day & Date */}
              <div className="relative z-10 min-w-[84px]">
                <p
                  className={`font-display text-base font-semibold ${titleText}`}
                >
                  {day.dayName}
                </p>
                <p className={`text-xs font-medium ${mutedText}`}>
                  {day.dateLabel}
                </p>
              </div>

              {/* Icon & Condition */}
              <div className="relative z-10 flex items-center sm:flex-col sm:items-center gap-2 sm:py-1">
                <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-105">
                  <WeatherIcon
                    iconCode={day.icon}
                    alt={day.description}
                    size={64}
                    className="w-12 h-12 sm:w-16 sm:h-16"
                  />
                </div>
                <div className="sm:text-center">
                  <p className={`text-sm font-semibold ${titleText}`}>
                    {day.condition}
                  </p>
                  <p
                    className={`text-xs capitalize hidden sm:block ${mutedText}`}
                  >
                    {day.description}
                  </p>
                </div>
              </div>

              {/* High / Low Temperatures + Real Proportional Range Bar */}
              <div className="relative z-10 flex flex-col gap-2 pt-0 sm:pt-2.5 sm:border-t sm:border-current/10 min-w-[96px] sm:min-w-0">
                {/* 5-Day Proportional Range Indicator */}
                <div
                  className={`hidden sm:block relative h-1.5 w-full rounded-full overflow-hidden ${trackBg}`}
                  aria-hidden="true"
                >
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: 0.65,
                      delay: 0.18 + idx * 0.06,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{
                      left: `${Math.min(startPct, 86)}%`,
                      width: `${Math.min(widthPct, 100 - Math.min(startPct, 86))}%`,
                      transformOrigin: 'left center',
                    }}
                    className={`absolute top-0 bottom-0 rounded-full ${
                      isLightTheme
                        ? 'bg-gradient-to-r from-sky-500 via-blue-500 to-amber-500'
                        : 'bg-gradient-to-r from-sky-300 via-cyan-200 to-amber-300'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-end sm:justify-between gap-3">
                  <div className="text-right sm:text-left">
                    <span
                      className={`block text-[11px] font-medium ${mutedText}`}
                    >
                      High
                    </span>
                    <span
                      className={`font-mono text-base sm:text-lg font-bold tabular-nums ${titleText}`}
                      data-testid="forecast-high"
                    >
                      {maxTemp}°{unit}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`block text-[11px] font-medium ${mutedText}`}
                    >
                      Low
                    </span>
                    <span
                      className={`font-mono text-base sm:text-lg font-medium tabular-nums ${subText}`}
                      data-testid="forecast-low"
                    >
                      {minTemp}°{unit}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Expandable Selected Day Summary Strip */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            key={selectedDay.dateKey}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <WeatherIcon
                iconCode={selectedDay.icon}
                alt={selectedDay.description}
                size={40}
                className="w-10 h-10 shrink-0"
              />
              <div>
                <p className={`font-display text-sm sm:text-base font-semibold ${titleText}`}>
                  {selectedDay.dayName}, {selectedDay.dateLabel} · {selectedDay.condition}
                </p>
                <p className={`text-xs capitalize ${mutedText}`}>
                  {selectedDay.description} · Based on {selectedDay.entryCount}{' '}
                  forecast intervals
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 font-mono text-xs sm:text-sm tabular-nums">
              <span className={subText}>
                Range:{' '}
                <strong className={titleText}>
                  {convertTemperature(selectedDay.tempMinC, unit)}°{unit} –{' '}
                  {convertTemperature(selectedDay.tempMaxC, unit)}°{unit}
                </strong>
              </span>
              <span className={mutedText}>
                Δ{' '}
                {Math.max(
                  0,
                  convertTemperature(selectedDay.tempMaxC, unit) -
                    convertTemperature(selectedDay.tempMinC, unit)
                )}
                °{unit}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
