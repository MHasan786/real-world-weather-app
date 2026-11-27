'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { WeatherTheme } from '@/lib/weather-utils';

interface AtmosphericBackdropProps {
  theme: WeatherTheme;
}

// Deterministic particle coordinates (SSR/hydration safe, no Math.random during render)
const RAIN_DROPS = [
  { left: '4%', delay: 0.1, duration: 0.95, height: 68, opacity: 0.32 },
  { left: '9%', delay: 0.65, duration: 1.15, height: 54, opacity: 0.22 },
  { left: '15%', delay: 0.3, duration: 0.88, height: 74, opacity: 0.36 },
  { left: '21%', delay: 0.9, duration: 1.05, height: 60, opacity: 0.26 },
  { left: '27%', delay: 0.2, duration: 0.92, height: 70, opacity: 0.34 },
  { left: '33%', delay: 0.75, duration: 1.2, height: 52, opacity: 0.2 },
  { left: '39%', delay: 0.45, duration: 0.9, height: 76, opacity: 0.35 },
  { left: '46%', delay: 0.15, duration: 1.08, height: 58, opacity: 0.25 },
  { left: '52%', delay: 0.82, duration: 0.96, height: 72, opacity: 0.32 },
  { left: '58%', delay: 0.38, duration: 1.12, height: 56, opacity: 0.24 },
  { left: '64%', delay: 0.05, duration: 0.86, height: 78, opacity: 0.38 },
  { left: '70%', delay: 0.6, duration: 1.04, height: 62, opacity: 0.28 },
  { left: '76%', delay: 0.28, duration: 0.94, height: 70, opacity: 0.34 },
  { left: '82%', delay: 0.88, duration: 1.18, height: 50, opacity: 0.22 },
  { left: '88%', delay: 0.42, duration: 0.9, height: 74, opacity: 0.34 },
  { left: '94%', delay: 0.7, duration: 1.02, height: 60, opacity: 0.26 },
];

const SNOW_FLAKES = [
  { left: '5%', size: 5, delay: 0, duration: 9.5, opacity: 0.75 },
  { left: '12%', size: 8, delay: 2.1, duration: 11.2, opacity: 0.6 },
  { left: '19%', size: 4, delay: 4.3, duration: 8.8, opacity: 0.8 },
  { left: '26%', size: 7, delay: 1.2, duration: 10.6, opacity: 0.65 },
  { left: '34%', size: 5, delay: 3.5, duration: 9.2, opacity: 0.7 },
  { left: '42%', size: 9, delay: 0.7, duration: 12.4, opacity: 0.55 },
  { left: '50%', size: 4, delay: 2.8, duration: 8.6, opacity: 0.78 },
  { left: '58%', size: 7, delay: 5.1, duration: 10.9, opacity: 0.62 },
  { left: '66%', size: 6, delay: 1.7, duration: 9.8, opacity: 0.72 },
  { left: '74%', size: 8, delay: 3.9, duration: 11.6, opacity: 0.58 },
  { left: '82%', size: 5, delay: 0.4, duration: 9.1, opacity: 0.76 },
  { left: '90%', size: 7, delay: 2.5, duration: 10.4, opacity: 0.64 },
  { left: '96%', size: 4, delay: 4.6, duration: 8.9, opacity: 0.72 },
];

const STARS = [
  { top: '8%', left: '10%', size: 2, delay: 0.2, duration: 3.4 },
  { top: '14%', left: '22%', size: 3, delay: 1.4, duration: 4.2 },
  { top: '6%', left: '35%', size: 2, delay: 0.8, duration: 3.1 },
  { top: '19%', left: '48%', size: 2.5, delay: 2.1, duration: 4.6 },
  { top: '10%', left: '61%', size: 3, delay: 0.5, duration: 3.8 },
  { top: '24%', left: '73%', size: 2, delay: 1.8, duration: 3.5 },
  { top: '9%', left: '85%', size: 2.5, delay: 1.1, duration: 4.4 },
  { top: '31%', left: '16%', size: 2, delay: 2.6, duration: 3.9 },
  { top: '28%', left: '39%', size: 2, delay: 0.3, duration: 4.1 },
  { top: '34%', left: '65%', size: 2.5, delay: 1.5, duration: 3.7 },
  { top: '21%', left: '91%', size: 2, delay: 2.3, duration: 3.3 },
  { top: '42%', left: '8%', size: 2, delay: 1.0, duration: 4.5 },
  { top: '40%', left: '82%', size: 2, delay: 0.7, duration: 3.6 },
];

const CLOUD_LAYERS = [
  { top: '6%', width: 420, height: 120, delay: 0, duration: 46, opacity: 0.22 },
  { top: '18%', width: 520, height: 140, delay: -18, duration: 58, opacity: 0.16 },
  { top: '32%', width: 360, height: 105, delay: -32, duration: 42, opacity: 0.14 },
];

const ORB_PALETTES: Record<WeatherTheme, [string, string, string]> = {
  default: [
    'radial-gradient(circle, rgba(56, 189, 248, 0.26) 0%, rgba(56, 189, 248, 0) 70%)',
    'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(99, 102, 241, 0) 70%)',
    'radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, rgba(14, 165, 233, 0) 70%)',
  ],
  clear: [
    'radial-gradient(circle, rgba(254, 240, 138, 0.55) 0%, rgba(251, 191, 36, 0.18) 42%, rgba(251, 146, 60, 0) 72%)',
    'radial-gradient(circle, rgba(251, 146, 60, 0.34) 0%, rgba(234, 88, 12, 0) 70%)',
    'radial-gradient(circle, rgba(56, 189, 248, 0.32) 0%, rgba(2, 132, 199, 0) 72%)',
  ],
  clouds: [
    'radial-gradient(circle, rgba(226, 232, 240, 0.24) 0%, rgba(148, 163, 184, 0) 70%)',
    'radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, rgba(30, 58, 95, 0) 70%)',
    'radial-gradient(circle, rgba(203, 213, 225, 0.18) 0%, rgba(71, 85, 105, 0) 70%)',
  ],
  rain: [
    'radial-gradient(circle, rgba(59, 130, 246, 0.28) 0%, rgba(29, 78, 216, 0) 70%)',
    'radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, rgba(15, 23, 42, 0) 70%)',
    'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(23, 37, 84, 0) 70%)',
  ],
  snow: [
    'radial-gradient(circle, rgba(255, 255, 255, 0.85) 0%, rgba(224, 242, 254, 0) 70%)',
    'radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, rgba(125, 211, 252, 0) 70%)',
    'radial-gradient(circle, rgba(255, 255, 255, 0.65) 0%, rgba(186, 230, 253, 0) 70%)',
  ],
  thunderstorm: [
    'radial-gradient(circle, rgba(168, 85, 247, 0.28) 0%, rgba(46, 16, 101, 0) 70%)',
    'radial-gradient(circle, rgba(59, 130, 246, 0.24) 0%, rgba(30, 27, 75, 0) 70%)',
    'radial-gradient(circle, rgba(192, 132, 252, 0.18) 0%, rgba(11, 7, 25, 0) 70%)',
  ],
  night: [
    'radial-gradient(circle, rgba(129, 140, 248, 0.26) 0%, rgba(46, 35, 108, 0) 70%)',
    'radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(23, 21, 59, 0) 70%)',
    'radial-gradient(circle, rgba(167, 139, 250, 0.2) 0%, rgba(2, 6, 23, 0) 70%)',
  ],
};

export default function AtmosphericBackdrop({ theme }: AtmosphericBackdropProps) {
  const [orbOne, orbTwo, orbThree] = ORB_PALETTES[theme];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden z-0"
    >
      {/* Slowly drifting atmospheric light orbs */}
      <div
        className="atmosphere-orb-one absolute -top-32 -right-24 w-[540px] h-[540px] rounded-full blur-3xl transition-all duration-700"
        style={{ background: orbOne }}
      />
      <div
        className="atmosphere-orb-two absolute top-1/3 -left-32 w-[480px] h-[480px] rounded-full blur-3xl transition-all duration-700"
        style={{ background: orbTwo }}
      />
      <div
        className="atmosphere-orb-three absolute -bottom-36 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl transition-all duration-700"
        style={{ background: orbThree }}
      />

      {/* Condition-specific animated atmospheric effects */}
      <AnimatePresence mode="wait">
        <motion.div
          key={theme}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          {/* Clear: Solar corona + subtle rotating sunbeams */}
          {theme === 'clear' && (
            <>
              <div className="sun-rays-spin absolute -top-44 -right-44 w-[620px] h-[620px] rounded-full opacity-35" />
              <div className="sun-corona-pulse absolute -top-14 right-10 w-56 h-56 rounded-full bg-amber-200/35 blur-2xl" />
            </>
          )}

          {/* Clouds: Drifting soft atmospheric cloud strata */}
          {(theme === 'clouds' || theme === 'default') && (
            <div className="absolute inset-0">
              {CLOUD_LAYERS.map((cloud, idx) => (
                <div
                  key={idx}
                  className="cloud-drift absolute rounded-full blur-3xl bg-white"
                  style={{
                    top: cloud.top,
                    width: cloud.width,
                    height: cloud.height,
                    opacity: theme === 'default' ? cloud.opacity * 0.45 : cloud.opacity,
                    animationDelay: `${cloud.delay}s`,
                    animationDuration: `${cloud.duration}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Rain & Thunderstorm: Falling diagonal rain streaks */}
          {(theme === 'rain' || theme === 'thunderstorm') && (
            <>
              <div className="absolute inset-0 overflow-hidden">
                {RAIN_DROPS.map((drop, idx) => (
                  <span
                    key={idx}
                    className="rain-streak absolute -top-24 w-[1.5px] rounded-full bg-gradient-to-b from-transparent via-sky-200/80 to-white/90"
                    style={{
                      left: drop.left,
                      height: `${drop.height}px`,
                      opacity: theme === 'thunderstorm' ? drop.opacity * 1.15 : drop.opacity,
                      animationDelay: `${drop.delay}s`,
                      animationDuration: `${
                        theme === 'thunderstorm' ? drop.duration * 0.8 : drop.duration
                      }s`,
                    }}
                  />
                ))}
              </div>
              {theme === 'thunderstorm' && (
                <div className="lightning-flash absolute inset-0 bg-indigo-100/20" />
              )}
            </>
          )}

          {/* Snow: Gently swaying drifting snowflakes */}
          {theme === 'snow' && (
            <div className="absolute inset-0 overflow-hidden">
              {SNOW_FLAKES.map((flake, idx) => (
                <span
                  key={idx}
                  className="snow-drift absolute -top-6 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                  style={{
                    left: flake.left,
                    width: `${flake.size}px`,
                    height: `${flake.size}px`,
                    opacity: flake.opacity,
                    animationDelay: `${flake.delay}s`,
                    animationDuration: `${flake.duration}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Night & Default: Subtle twinkling stars */}
          {(theme === 'night' || theme === 'default') && (
            <div className="absolute inset-0">
              {STARS.map((star, idx) => (
                <span
                  key={idx}
                  className="star-twinkle absolute rounded-full bg-white"
                  style={{
                    top: star.top,
                    left: star.left,
                    width: `${star.size}px`,
                    height: `${star.size}px`,
                    animationDelay: `${star.delay}s`,
                    animationDuration: `${star.duration}s`,
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Subtle atmospheric noise/vignette depth layer */}
      <div
        className={`absolute inset-0 ${
          theme === 'snow'
            ? 'bg-gradient-to-b from-white/15 via-transparent to-sky-900/10'
            : 'bg-gradient-to-b from-black/10 via-transparent to-black/25'
        }`}
      />
    </div>
  );
}
