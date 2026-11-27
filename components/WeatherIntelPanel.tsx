'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import {
  AlertCircle,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  getCountryName,
  type CurrentWeatherData,
  type WeatherAlert,
} from '@/lib/weather-utils';

interface GroundingLink {
  title: string;
  uri: string;
  kind: 'web' | 'maps';
  snippet?: string;
}

interface BriefingResult {
  markdown: string;
  links: GroundingLink[];
}

interface WeatherIntelPanelProps {
  weather: CurrentWeatherData;
  alerts: WeatherAlert[];
  isLightTheme: boolean;
  requestedTab?: 'search' | 'maps' | null;
  requestedNonce?: number;
}

export default function WeatherIntelPanel({
  weather,
  alerts,
  isLightTheme,
  requestedTab = null,
  requestedNonce = 0,
}: WeatherIntelPanelProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'maps'>('search');
  const [searchResult, setSearchResult] = useState<BriefingResult | null>(null);
  const [mapsResult, setMapsResult] = useState<BriefingResult | null>(null);
  const [loadingMode, setLoadingMode] = useState<'search' | 'maps' | null>(null);
  const [errorByMode, setErrorByMode] = useState<{
    search: string | null;
    maps: string | null;
  }>({ search: null, maps: null });

  const fetchGroundedIntel = useCallback(
    async (mode: 'search' | 'maps') => {
      setLoadingMode(mode);
      setErrorByMode((prev) => ({ ...prev, [mode]: null }));

      try {
        const res = await fetch('/api/weather/briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            city: weather.name,
            country: getCountryName(weather.sys.country),
            lat: weather.coord.lat,
            lon: weather.coord.lon,
            condition: weather.weather[0]?.description || weather.weather[0]?.main,
            tempC: weather.main.temp,
            alertTitles: alerts.map((a) => a.title),
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.error || 'Unable to load grounded weather intelligence.'
          );
        }

        const parsed: BriefingResult = {
          markdown: data.markdown || '',
          links: Array.isArray(data.links) ? data.links : [],
        };

        if (mode === 'search') {
          setSearchResult(parsed);
        } else {
          setMapsResult(parsed);
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to reach live grounding service.';
        setErrorByMode((prev) => ({ ...prev, [mode]: msg }));
      } finally {
        setLoadingMode((prev) => (prev === mode ? null : prev));
      }
    },
    [weather, alerts]
  );

  // Trigger requested tab from WeatherAlertBanner quick actions
  useEffect(() => {
    if (!requestedTab || requestedNonce === 0) return;
    queueMicrotask(() => {
      setActiveTab(requestedTab);
      fetchGroundedIntel(requestedTab);
    });
  }, [requestedTab, requestedNonce, fetchGroundedIntel]);

  const titleText = isLightTheme ? 'text-slate-900' : 'text-white';
  const subText = isLightTheme ? 'text-slate-700' : 'text-white/85';
  const mutedText = isLightTheme ? 'text-slate-600' : 'text-white/65';
  const tabWrap = isLightTheme
    ? 'bg-slate-900/10 border-slate-900/15'
    : 'bg-white/10 border-white/15';
  const activeTabBg = isLightTheme
    ? 'bg-slate-900 text-white'
    : 'bg-white text-slate-900';
  const inactiveTabText = isLightTheme
    ? 'text-slate-700 hover:text-slate-950'
    : 'text-white/80 hover:text-white';
  const actionBtn = isLightTheme
    ? 'bg-slate-900 hover:bg-slate-800 text-white'
    : 'bg-white hover:bg-white/90 text-slate-900';
  const linkCard = isLightTheme
    ? 'bg-white/75 hover:bg-white border-slate-900/12 text-slate-900'
    : 'bg-white/10 hover:bg-white/18 border-white/15 text-white';

  const currentResult = activeTab === 'search' ? searchResult : mapsResult;
  const currentError = errorByMode[activeTab];
  const isCurrentLoading = loadingMode === activeTab;

  return (
    <section
      id="weather-intel-panel"
      aria-label="Live grounded weather intelligence"
      className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2
            className={`font-display text-lg sm:text-xl font-bold tracking-tight ${titleText}`}
          >
            Live Advisories &amp; Nearby Places
          </h2>
          <p className={`text-xs ${mutedText}`}>
            Real-time Google Search advisories and Google Maps location guidance
            for {weather.name}
          </p>
        </div>

        {/* Segmented Grounding Mode Switch */}
        <div
          className={`flex items-center p-1 rounded-xl border self-start sm:self-auto ${tabWrap}`}
          role="tablist"
          aria-label="Grounding data source"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'search'}
            onClick={() => setActiveTab('search')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'search' ? activeTabBg : inactiveTabText
            }`}
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Search Advisories</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'maps'}
            onClick={() => setActiveTab('maps')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'maps' ? activeTabBg : inactiveTabText
            }`}
          >
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Maps Places</span>
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className={`text-xs sm:text-sm ${subText}`}>
          {activeTab === 'search'
            ? `Check live web bulletins, storm/heat advisories, and travel weather impacts in ${weather.name}.`
            : `Discover real nearby shelters, indoor refuges, or weather-matched places around ${weather.name}.`}
        </p>

        <button
          type="button"
          disabled={isCurrentLoading}
          onClick={() => fetchGroundedIntel(activeTab)}
          className={`h-9 px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-55 ${actionBtn}`}
        >
          {isCurrentLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>
            {currentResult
              ? 'Refresh Live Data'
              : activeTab === 'search'
                ? 'Load Live Advisories'
                : 'Find Nearby Places'}
          </span>
        </button>
      </div>

      {/* Error State */}
      {currentError ? (
        <div
          role="alert"
          className={`rounded-2xl px-4 py-3 border flex items-center gap-2.5 text-xs sm:text-sm ${
            isLightTheme
              ? 'bg-red-50/90 border-red-300 text-red-900'
              : 'bg-red-950/60 border-red-400/35 text-red-100'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" aria-hidden="true" />
          <span>{currentError}</span>
        </div>
      ) : null}

      {/* Result Content */}
      <AnimatePresence mode="wait">
        {isCurrentLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl p-6 border border-current/10 flex items-center justify-center gap-3 text-sm"
          >
            <Loader2 className={`w-4 h-4 animate-spin ${titleText}`} aria-hidden="true" />
            <span className={subText}>
              {activeTab === 'search'
                ? 'Searching live web weather advisories...'
                : 'Querying Google Maps nearby places...'}
            </span>
          </motion.div>
        ) : currentResult ? (
          <motion.div
            key={`${activeTab}-result`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div
              className={`rounded-2xl p-4 sm:p-5 border text-sm leading-relaxed space-y-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_strong]:font-semibold [&_h3]:font-display [&_h3]:font-semibold [&_h3]:text-base ${
                isLightTheme
                  ? 'bg-white/65 border-slate-900/10 text-slate-800'
                  : 'bg-black/20 border-white/12 text-white/90'
              }`}
            >
              <Markdown>{currentResult.markdown}</Markdown>
            </div>

            {currentResult.links.length > 0 ? (
              <div className="space-y-2">
                <p className={`text-xs font-semibold ${mutedText}`}>
                  {activeTab === 'maps'
                    ? 'Google Maps Sources & Place Links'
                    : 'Verified Search Sources'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentResult.links.map((link) => (
                    <a
                      key={link.uri}
                      href={link.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`rounded-xl px-3.5 py-2.5 border flex items-start justify-between gap-2.5 transition-colors ${linkCard}`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold truncate">
                          {link.title}
                        </p>
                        {link.snippet ? (
                          <p className={`text-[11px] line-clamp-2 ${mutedText}`}>
                            {link.snippet}
                          </p>
                        ) : null}
                      </div>
                      <ExternalLink
                        className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-75"
                        aria-hidden="true"
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
