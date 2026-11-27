'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
} from 'lucide-react';
import { getWeatherIconUrl } from '@/lib/weather-utils';

interface WeatherIconProps {
  iconCode: string;
  alt: string;
  size?: number;
  className?: string;
}

function FallbackIcon({
  iconCode,
  size,
  className,
}: {
  iconCode: string;
  size: number;
  className?: string;
}) {
  const prefix = iconCode.slice(0, 2);
  const isNight = iconCode.endsWith('n');

  if (prefix === '01') {
    return isNight ? (
      <Moon size={size * 0.65} className={className} aria-hidden="true" />
    ) : (
      <Sun size={size * 0.65} className={className} aria-hidden="true" />
    );
  }
  if (prefix === '09' || prefix === '10') {
    return <CloudRain size={size * 0.65} className={className} aria-hidden="true" />;
  }
  if (prefix === '11') {
    return <CloudLightning size={size * 0.65} className={className} aria-hidden="true" />;
  }
  if (prefix === '13') {
    return <CloudSnow size={size * 0.65} className={className} aria-hidden="true" />;
  }
  if (prefix === '50') {
    return <CloudFog size={size * 0.65} className={className} aria-hidden="true" />;
  }
  return <Cloud size={size * 0.65} className={className} aria-hidden="true" />;
}

export default function WeatherIcon({
  iconCode,
  alt,
  size = 96,
  className = '',
}: WeatherIconProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={alt}
      >
        <FallbackIcon iconCode={iconCode} size={size} />
      </div>
    );
  }

  return (
    <Image
      src={getWeatherIconUrl(iconCode)}
      alt={alt}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`object-contain drop-shadow-md ${className}`}
    />
  );
}
