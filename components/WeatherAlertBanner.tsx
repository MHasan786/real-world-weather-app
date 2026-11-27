'use client';

import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Info,
  MapPinned,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  formatAlertTimeRange,
  type WeatherAlert,
  type WeatherAlertSeverity,
} from '@/lib/weather-utils';

interface WeatherAlertBannerProps {
  alerts: WeatherAlert[];
  timezoneOffsetSeconds: number;
  onInspectBriefing?: () => void;
  onFindShelters?: () => void;
}

const SEVERITY_STYLES: Record<
  WeatherAlertSeverity,
  {
    container: string;
    badge: string;
    divider: string;
    label: string;
    Icon: typeof AlertTriangle;
  }
> = {
  EXTREME: {
    container:
      'bg-red-950/92 border-red-400/60 text-red-50 shadow-xl shadow-red-950/40',
    badge: 'bg-red-500 text-white',
    divider: 'border-red-300/20',
    label: 'Extreme Warning',
    Icon: AlertOctagon,
  },
  SEVERE: {
    container:
      'bg-orange-950/92 border-orange-400/55 text-orange-50 shadow-xl shadow-orange-950/35',
    badge: 'bg-orange-500 text-slate-950',
    divider: 'border-orange-300/20',
    label: 'Severe Warning',
    Icon: AlertTriangle,
  },
  MODERATE: {
    container:
      'bg-amber-950/90 border-amber-400/50 text-amber-50 shadow-lg shadow-amber-950/30',
    badge: 'bg-amber-400 text-slate-950',
    divider: 'border-amber-300/20',
    label: 'Weather Advisory',
    Icon: ShieldAlert,
  },
  MINOR: {
    container:
      'bg-sky-950/90 border-sky-400/45 text-sky-50 shadow-lg shadow-sky-950/30',
    badge: 'bg-sky-400 text-slate-950',
    divider: 'border-sky-300/20',
    label: 'Weather Statement',
    Icon: Info,
  },
  UNKNOWN: {
    container:
      'bg-amber-950/88 border-amber-300/45 text-amber-50 shadow-lg shadow-amber-950/25',
    badge: 'bg-amber-300 text-slate-950',
    divider: 'border-amber-200/20',
    label: 'Active Alert',
    Icon: AlertTriangle,
  },
};

export default function WeatherAlertBanner({
  alerts,
  timezoneOffsetSeconds,
  onInspectBriefing,
  onFindShelters,
}: WeatherAlertBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const visibleAlerts = alerts.filter(
    (alert) => !dismissedIds.includes(alert.alertId)
  );

  if (visibleAlerts.length === 0) return null;

  const safeIndex = Math.min(activeIndex, visibleAlerts.length - 1);
  const activeAlert = visibleAlerts[safeIndex];
  const style = SEVERITY_STYLES[activeAlert.severity] || SEVERITY_STYLES.UNKNOWN;
  const SeverityIcon = style.Icon;
  const timeRange = formatAlertTimeRange(
    activeAlert.startTime,
    activeAlert.expirationTime,
    timezoneOffsetSeconds
  );

  return (
    <AnimatePresence>
      <motion.section
        key={activeAlert.alertId}
        role="region"
        aria-label="Severe weather alerts"
        aria-live="assertive"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`rounded-2xl border backdrop-blur-md overflow-hidden ${style.container}`}
        data-testid="weather-alert-banner"
      >
        {/* Top Summary Bar */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${style.badge}`}
              >
                <SeverityIcon className="w-5 h-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h2
                    className="font-display text-base sm:text-lg font-bold tracking-tight"
                    data-testid="weather-alert-title"
                  >
                    {activeAlert.title}
                  </h2>
                  <span className="text-xs font-semibold opacity-90">
                    {style.label}
                    {activeAlert.urgency && activeAlert.urgency !== 'UNKNOWN'
                      ? ` · ${activeAlert.urgency.toLowerCase()}`
                      : ''}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs opacity-85">
                  <span className="truncate max-w-full sm:max-w-lg">
                    {activeAlert.areaName}
                  </span>
                  {timeRange ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{timeRange}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right controls: multi-alert pager + expand + dismiss */}
            <div className="flex items-center gap-1.5 shrink-0">
              {visibleAlerts.length > 1 && (
                <div className="flex items-center gap-1 mr-1">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIndex((prev) =>
                        prev <= 0 ? visibleAlerts.length - 1 : prev - 1
                      )
                    }
                    aria-label="Previous weather alert"
                    className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <span className="font-mono text-xs tabular-nums opacity-90 whitespace-nowrap">
                    {safeIndex + 1}/{visibleAlerts.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIndex((prev) => (prev + 1) % visibleAlerts.length)
                    }
                    aria-label="Next weather alert"
                    className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                className="h-8 px-3 rounded-lg bg-white/12 hover:bg-white/22 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>{expanded ? 'Hide details' : 'Details'}</span>
                {expanded ? (
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setDismissedIds((prev) => [...prev, activeAlert.alertId])
                }
                aria-label="Dismiss weather alert"
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Expanded Details Drawer */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className={`overflow-hidden pt-3.5 border-t ${style.divider} text-xs sm:text-sm`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {activeAlert.description ? (
                    <div
                      className={
                        (activeAlert.instruction && activeAlert.instruction.length > 0) ||
                        (activeAlert.safetyRecommendations &&
                          activeAlert.safetyRecommendations.length > 0)
                          ? 'lg:col-span-7 space-y-2'
                          : 'lg:col-span-12 space-y-2'
                      }
                    >
                      <p className="font-semibold text-xs uppercase tracking-wider opacity-75">
                        Bulletin Summary
                      </p>
                      <p className="leading-relaxed opacity-95 whitespace-pre-line">
                        {activeAlert.description
                          .replace(/\*\s*([A-Z ]+)\.{2,}/g, '$1: ')
                          .replace(/\n{3,}/g, '\n\n')
                          .trim()}
                      </p>
                    </div>
                  ) : null}

                  {(activeAlert.instruction && activeAlert.instruction.length > 0) ||
                  (activeAlert.safetyRecommendations &&
                    activeAlert.safetyRecommendations.length > 0) ? (
                    <div
                      className={`${
                        activeAlert.description ? 'lg:col-span-5' : 'lg:col-span-12'
                      } rounded-xl bg-black/22 border border-white/10 p-3.5 space-y-3 self-start`}
                    >
                      {activeAlert.instruction && activeAlert.instruction.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="font-semibold text-xs uppercase tracking-wider opacity-80">
                            Recommended Actions
                          </p>
                          <ul className="list-disc pl-4 space-y-1.5 opacity-95 leading-relaxed">
                            {activeAlert.instruction.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {activeAlert.safetyRecommendations &&
                      activeAlert.safetyRecommendations.length > 0 ? (
                        <div className="space-y-2">
                          <p className="font-semibold text-xs uppercase tracking-wider opacity-80">
                            Safety Directives
                          </p>
                          <div className="space-y-2">
                            {activeAlert.safetyRecommendations.map((rec, i) => (
                              <div
                                key={i}
                                className="rounded-lg bg-black/20 px-3 py-2 space-y-0.5"
                              >
                                <p className="font-semibold">{rec.directive}</p>
                                {rec.subtext ? (
                                  <p className="text-xs opacity-85">{rec.subtext}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mandatory Official Source Attribution + Quick Action Row */}
          <div
            className={`pt-2.5 border-t ${style.divider} flex flex-wrap items-center justify-between gap-2 text-xs`}
          >
            <p className="opacity-90">
              Source:{' '}
              {activeAlert.dataSource.authorityUri ? (
                <a
                  href={activeAlert.dataSource.authorityUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold inline-flex items-center gap-1 hover:opacity-100"
                >
                  <span>{activeAlert.dataSource.name}</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              ) : (
                <span className="font-semibold">
                  {activeAlert.dataSource.name}
                </span>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {onInspectBriefing ? (
                <button
                  type="button"
                  onClick={onInspectBriefing}
                  className="h-7 px-2.5 rounded-lg bg-white/12 hover:bg-white/22 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Search className="w-3 h-3" aria-hidden="true" />
                  <span>Live Safety Updates</span>
                </button>
              ) : null}
              {onFindShelters ? (
                <button
                  type="button"
                  onClick={onFindShelters}
                  className="h-7 px-2.5 rounded-lg bg-white/12 hover:bg-white/22 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <MapPinned className="w-3 h-3" aria-hidden="true" />
                  <span>Nearby Shelters</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
