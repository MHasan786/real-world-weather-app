'use client';

import React, { useState, type FormEvent } from 'react';
import { CloudSun, Search, MapPin, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { TemperatureUnit } from '@/lib/weather-utils';

interface WeatherHeaderProps {
  onSearch: (city: string) => void;
  onUseLocation: () => void;
  unit: TemperatureUnit;
  onToggleUnit: (unit: TemperatureUnit) => void;
  isLoading: boolean;
  isLightTheme: boolean;
}

export default function WeatherHeader({
  onSearch,
  onUseLocation,
  unit,
  onToggleUnit,
  isLoading,
  isLightTheme,
}: WeatherHeaderProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  };

  const surfaceText = isLightTheme ? 'text-slate-900' : 'text-white';
  const mutedText = isLightTheme ? 'text-slate-600' : 'text-white/75';
  const inputBg = isLightTheme
    ? 'bg-white/80 text-slate-900 placeholder:text-slate-500 border-slate-900/15 focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20'
    : 'bg-white/10 text-white placeholder:text-white/55 border-white/20 focus:border-white/50 focus:bg-white/15 focus:ring-2 focus:ring-white/20';
  const toggleWrap = isLightTheme
    ? 'bg-slate-900/10 border-slate-900/15'
    : 'bg-white/10 border-white/20';
  const togglePillBg = isLightTheme
    ? 'bg-slate-900 shadow-sm'
    : 'bg-white shadow-sm';
  const toggleActiveText = isLightTheme ? 'text-white' : 'text-slate-900';
  const toggleInactiveText = isLightTheme
    ? 'text-slate-700 hover:text-slate-950'
    : 'text-white/80 hover:text-white';
  const locationBtn = isLightTheme
    ? 'bg-white/75 hover:bg-white text-slate-900 border-slate-900/15'
    : 'bg-white/12 hover:bg-white/22 text-white border-white/20';
  const searchBtn = isLightTheme
    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/15'
    : 'bg-white text-slate-900 hover:bg-white/95 shadow-md shadow-black/20';

  const renderUnitToggle = (layoutGroupId: string, paddingClass: string) => (
    <div
      className={`relative flex items-center p-1 rounded-xl border ${toggleWrap}`}
      role="group"
      aria-label="Temperature unit"
    >
      {(['C', 'F'] as const).map((option) => {
        const isActive = unit === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggleUnit(option)}
            aria-pressed={isActive}
            className={`relative z-10 ${paddingClass} text-xs font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              isActive ? toggleActiveText : toggleInactiveText
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={layoutGroupId}
                transition={{ type: 'spring', stiffness: 520, damping: 36 }}
                className={`absolute inset-0 rounded-lg -z-10 ${togglePillBg}`}
              />
            )}
            °{option}
          </button>
        );
      })}
    </div>
  );

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-20 w-full pt-4 pb-2 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-6xl mx-auto glass-panel rounded-2xl px-4 py-3 sm:px-6 sm:py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Brand Logo + Name */}
          <div className="flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: [-3, 4, 0], scale: 1.06 }}
                transition={{ duration: 0.35 }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isLightTheme
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                    : 'bg-white/15 text-amber-300 border border-white/15 shadow-inner'
                }`}
              >
                <CloudSun className="w-5 h-5" aria-hidden="true" />
              </motion.div>
              <span
                className={`font-display text-xl font-bold tracking-tight whitespace-nowrap shrink-0 ${surfaceText}`}
              >
                WeatherNow
              </span>
            </div>

            {/* Mobile unit switch beside logo on small screens */}
            <div className="flex lg:hidden">
              {renderUnitToggle('unit-pill-mobile', 'px-2.5 py-1.5')}
            </div>
          </div>

          {/* Search Form */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 flex-1 max-w-xl w-full"
            role="search"
            aria-label="City weather search"
          >
            <div className="relative flex-1 min-w-0">
              <label htmlFor="city-search-input" className="sr-only">
                City name
              </label>
              <Search
                className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${mutedText}`}
                aria-hidden="true"
              />
              <input
                id="city-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any city worldwide..."
                autoComplete="off"
                className={`w-full h-11 pl-10 pr-9 rounded-xl border text-sm font-medium outline-none transition-all duration-200 ${inputBg}`}
              />
              <AnimatePresence>
                {query.length > 0 && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setQuery('')}
                    aria-label="Clear search text"
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors cursor-pointer ${
                      isLightTheme
                        ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-900/10'
                        : 'text-white/60 hover:text-white hover:bg-white/15'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <motion.button
              type="submit"
              disabled={isLoading || !query.trim()}
              whileHover={{ scale: isLoading || !query.trim() ? 1 : 1.02 }}
              whileTap={{ scale: isLoading || !query.trim() ? 1 : 0.97 }}
              transition={{ duration: 0.15 }}
              className={`h-11 px-4 sm:px-5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${searchBtn}`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>Search</span>
            </motion.button>
          </form>

          {/* Controls: Unit Toggle (desktop) + Use My Location */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden lg:flex">
              {renderUnitToggle('unit-pill-desktop', 'px-3 py-1.5')}
            </div>

            <motion.button
              type="button"
              onClick={onUseLocation}
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.97 }}
              transition={{ duration: 0.15 }}
              className={`h-11 px-4 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer w-full sm:w-auto disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${locationBtn}`}
            >
              <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Use My Location</span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
