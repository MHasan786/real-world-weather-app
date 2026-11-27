'use client';

import React, { useEffect, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import { AlertTriangle, Crosshair, Map as MapIcon } from 'lucide-react';
import {
  convertTemperature,
  parseAlertPolygonRings,
  type CurrentWeatherData,
  type TemperatureUnit,
  type WeatherAlert,
  type WeatherAlertSeverity,
} from '@/lib/weather-utils';
import { isValidGoogleMapsApiKey } from '@/lib/maps-config';

interface WeatherMapPanelProps {
  apiKey: string;
  weather: CurrentWeatherData;
  alerts: WeatherAlert[];
  unit: TemperatureUnit;
  isLightTheme: boolean;
  mapsAuthError?: boolean;
  onSelectLocation: (lat: number, lon: number) => void;
}

const ALERT_FILL_COLORS: Record<WeatherAlertSeverity, string> = {
  EXTREME: '#dc2626',
  SEVERE: '#ea580c',
  MODERATE: '#d97706',
  MINOR: '#0284c7',
  UNKNOWN: '#f59e0b',
};

function MapCameraSync({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo({ lat, lng });
  }, [map, lat, lng]);

  return null;
}

function AlertPolygonLayer({ alerts }: { alerts: WeatherAlert[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.Polygon) return;

    const polygons: google.maps.Polygon[] = [];

    for (const alert of alerts) {
      const rings = parseAlertPolygonRings(alert.polygon);
      if (rings.length === 0) continue;
      const color = ALERT_FILL_COLORS[alert.severity] || ALERT_FILL_COLORS.UNKNOWN;

      for (const path of rings) {
        const poly = new google.maps.Polygon({
          paths: path,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.22,
          clickable: false,
          map,
        });
        polygons.push(poly);
      }
    }

    return () => {
      for (const poly of polygons) {
        poly.setMap(null);
      }
    };
  }, [map, alerts]);

  return null;
}

function CityWeatherMarker({
  weather,
  alerts,
  unit,
}: {
  weather: CurrentWeatherData;
  alerts: WeatherAlert[];
  unit: TemperatureUnit;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  const tempDisplay = convertTemperature(weather.main.temp, unit);
  const condition = weather.weather[0];
  const hasAlerts = alerts.length > 0;
  const position = { lat: weather.coord.lat, lng: weather.coord.lon };

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={`${weather.name}: ${tempDisplay}°${unit}`}
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-lg cursor-pointer transition-transform hover:scale-105 ${
            hasAlerts
              ? 'bg-red-950/95 border-red-400 text-white'
              : 'bg-slate-900/95 border-white/30 text-white'
          }`}
        >
          {hasAlerts ? (
            <AlertTriangle
              className="w-3.5 h-3.5 text-amber-300 shrink-0"
              aria-hidden="true"
            />
          ) : null}
          <span className="font-display text-xs font-semibold whitespace-nowrap">
            {weather.name}
          </span>
          <span className="font-mono text-xs font-bold tabular-nums text-sky-300 whitespace-nowrap">
            {tempDisplay}°{unit}
          </span>
        </div>
      </AdvancedMarker>

      {infoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={260}
          onCloseClick={() => setInfoOpen(false)}
        >
          <div className="p-1 text-slate-900 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-sm font-bold">{weather.name}</p>
              <span className="font-mono text-sm font-bold tabular-nums">
                {tempDisplay}°{unit}
              </span>
            </div>
            <p className="text-xs capitalize text-slate-600">
              {condition?.description || 'Current conditions'} · Humidity{' '}
              {weather.main.humidity}% · Wind {weather.wind.speed.toFixed(1)} m/s
            </p>
            <p className="font-mono text-[11px] text-slate-500 tabular-nums">
              {weather.coord.lat.toFixed(3)}, {weather.coord.lon.toFixed(3)}
            </p>
            {hasAlerts ? (
              <p className="text-xs font-semibold text-red-700 pt-1 border-t border-slate-200">
                {alerts.length} active weather{' '}
                {alerts.length === 1 ? 'alert' : 'alerts'}: {alerts[0].title}
              </p>
            ) : null}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export default function WeatherMapPanel({
  apiKey,
  weather,
  alerts,
  unit,
  isLightTheme,
  mapsAuthError = false,
  onSelectLocation,
}: WeatherMapPanelProps) {
  const titleText = isLightTheme ? 'text-slate-900' : 'text-white';
  const mutedText = isLightTheme ? 'text-slate-600' : 'text-white/70';

  const rawKey =
    apiKey ||
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
      : '');
  const resolvedKey = isValidGoogleMapsApiKey(rawKey) ? rawKey.trim() : '';

  const center = { lat: weather.coord.lat, lng: weather.coord.lon };

  return (
    <section
      aria-label="Interactive Google Map"
      className="glass-panel rounded-3xl p-5 sm:p-6 flex flex-col gap-4 h-full"
    >
      <div className="flex items-start justify-between gap-3 min-h-[56px]">
        <div className="flex items-start gap-2.5 min-w-0">
          <MapIcon className={`w-5 h-5 mt-0.5 shrink-0 ${titleText}`} aria-hidden="true" />
          <div className="min-w-0">
            <h2
              className={`font-display text-lg sm:text-xl font-bold tracking-tight ${titleText}`}
            >
              Interactive Weather &amp; Alert Map
            </h2>
            <p className={`text-xs leading-snug ${mutedText}`}>
              Click any point to inspect live weather and active alert zones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums shrink-0 pt-0.5">
          <Crosshair className={`w-3.5 h-3.5 ${mutedText}`} aria-hidden="true" />
          <span className={mutedText}>
            {weather.coord.lat.toFixed(2)}, {weather.coord.lon.toFixed(2)}
          </span>
        </div>
      </div>

      {resolvedKey && !mapsAuthError ? (
        <div className="flex-1 w-full min-h-[380px] sm:min-h-[420px] rounded-2xl overflow-hidden border border-white/15">
          <APIProvider
            apiKey={resolvedKey}
            libraries={['marker']}
            language="en"
            region="US"
          >
            <GoogleMap
              mapId="DEMO_MAP_ID"
              defaultCenter={center}
              defaultZoom={10}
              gestureHandling="greedy"
              streetViewControl={false}
              mapTypeControl={true}
              fullscreenControl={true}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              onClick={(ev) => {
                const latLng = ev.detail?.latLng;
                if (
                  latLng &&
                  typeof latLng.lat === 'number' &&
                  typeof latLng.lng === 'number'
                ) {
                  onSelectLocation(latLng.lat, latLng.lng);
                }
              }}
              style={{ width: '100%', height: '100%' }}
            >
              <MapCameraSync lat={center.lat} lng={center.lng} />
              <AlertPolygonLayer alerts={alerts} />
              <CityWeatherMarker
                weather={weather}
                alerts={alerts}
                unit={unit}
              />
            </GoogleMap>
          </APIProvider>
        </div>
      ) : (
        <div className="flex-1 w-full min-h-[380px] sm:min-h-[420px] rounded-2xl border border-white/15 bg-slate-950/40 flex flex-col items-center justify-center p-6 text-center gap-2.5">
          <MapIcon className="w-8 h-8 text-sky-300/80" aria-hidden="true" />
          <p className="font-display text-sm font-semibold text-white">
            {mapsAuthError
              ? 'Google Maps authentication failed'
              : 'Interactive Google Map unavailable'}
          </p>
          <p className="text-xs text-white/75 max-w-md leading-relaxed">
            {mapsAuthError
              ? 'The configured Google Maps API key was rejected (InvalidKeyMapError). Verify your key and Maps JavaScript API enablement in Settings.'
              : 'Enable Google Maps Platform in AI Studio Settings to load the interactive regional map and alert boundary polygons.'}
          </p>
        </div>
      )}
    </section>
  );
}
