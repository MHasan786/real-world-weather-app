// Configure your personal free OpenWeatherMap API key below.
// Security note: Frontend API keys are visible to anyone inspecting browser source or network requests.
// For production applications, route requests through a backend proxy so your key remains secret.
const API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY';

const CURRENT_WEATHER_BASE = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_BASE = 'https://api.openweathermap.org/data/2.5/forecast';
const RECENT_STORAGE_KEY = 'weathernow_recent_searches';

const appState = {
  unit: 'C',
  currentWeather: null,
  forecastList: [],
  recentSearches: [],
  abortController: null,
  requestCounter: 0,
  toastTimer: null,
};

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  loadRecentSearches();
  displayRecentSearches();

  const searchForm = document.getElementById('search-form');
  const cityInput = document.getElementById('city-input');
  const locationBtn = document.getElementById('location-button');
  const clearRecentBtn = document.getElementById('clear-recent-button');
  const dismissErrorBtn = document.getElementById('dismiss-error-button');
  const closeToastBtn = document.getElementById('close-toast-button');
  const unitButtons = document.querySelectorAll('.unit-btn');

  if (searchForm) {
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (cityInput) {
        searchCity(cityInput.value);
      }
    });
  }

  if (locationBtn) {
    locationBtn.addEventListener('click', () => {
      getUserLocation();
    });
  }

  if (clearRecentBtn) {
    clearRecentBtn.addEventListener('click', () => {
      appState.recentSearches = [];
      localStorage.removeItem(RECENT_STORAGE_KEY);
      displayRecentSearches();
    });
  }

  if (dismissErrorBtn) {
    dismissErrorBtn.addEventListener('click', () => {
      const errorBox = document.getElementById('error-container');
      if (errorBox) errorBox.classList.add('hidden');
    });
  }

  if (closeToastBtn) {
    closeToastBtn.addEventListener('click', () => {
      const toast = document.getElementById('error-toast');
      if (toast) toast.classList.add('hidden');
    });
  }

  unitButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextUnit = btn.getAttribute('data-unit');
      if (nextUnit === 'C' || nextUnit === 'F') {
        toggleTemperatureUnit(nextUnit);
      }
    });
  });

  if (appState.recentSearches.length > 0) {
    searchCity(appState.recentSearches[0]);
  }
}

async function searchCity(rawCity) {
  const city = (rawCity || '').trim();
  if (!city) {
    showError('Please enter a city name to search.');
    return;
  }

  if (!API_KEY || API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
    showError(
      'OpenWeatherMap API key is not configured. Add your free API key to script.js.'
    );
    return;
  }

  if (appState.abortController) {
    appState.abortController.abort();
  }
  const controller = new AbortController();
  appState.abortController = controller;
  const reqId = ++appState.requestCounter;

  showLoading(true);

  try {
    const [currentData, forecastData] = await Promise.all([
      fetchCurrentWeather(city, controller.signal),
      fetchForecast(city, controller.signal),
    ]);

    if (reqId !== appState.requestCounter) return;

    appState.currentWeather = currentData;
    appState.forecastList = forecastData.list || [];

    displayCurrentWeather(currentData);
    displayForecast(appState.forecastList, currentData.timezone, currentData.dt);
    updateWeatherBackground(currentData);
    saveRecentSearch(currentData.name);
    displayRecentSearches();
  } catch (error) {
    if (error && error.name === 'AbortError') return;
    if (reqId !== appState.requestCounter) return;
    showError(error.message || 'Unable to fetch weather data.');
  } finally {
    if (reqId === appState.requestCounter) {
      showLoading(false);
    }
  }
}

async function fetchCurrentWeather(city, signal) {
  const url = `${CURRENT_WEATHER_BASE}?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(API_KEY)}&units=metric`;
  const response = await fetch(url, { signal });
  return handleApiResponse(response);
}

async function fetchForecast(city, signal) {
  const url = `${FORECAST_BASE}?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(API_KEY)}&units=metric`;
  const response = await fetch(url, { signal });
  return handleApiResponse(response);
}

async function fetchWeatherByCoordinates(lat, lon) {
  if (!API_KEY || API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
    showError(
      'OpenWeatherMap API key is not configured. Add your free API key to script.js.'
    );
    return;
  }

  if (appState.abortController) {
    appState.abortController.abort();
  }
  const controller = new AbortController();
  appState.abortController = controller;
  const reqId = ++appState.requestCounter;

  showLoading(true);

  try {
    const currentUrl = `${CURRENT_WEATHER_BASE}?lat=${lat}&lon=${lon}&appid=${encodeURIComponent(API_KEY)}&units=metric`;
    const forecastUrl = `${FORECAST_BASE}?lat=${lat}&lon=${lon}&appid=${encodeURIComponent(API_KEY)}&units=metric`;

    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl, { signal: controller.signal }),
      fetch(forecastUrl, { signal: controller.signal }),
    ]);

    const currentData = await handleApiResponse(currentRes);
    const forecastData = await handleApiResponse(forecastRes);

    if (reqId !== appState.requestCounter) return;

    appState.currentWeather = currentData;
    appState.forecastList = forecastData.list || [];

    displayCurrentWeather(currentData);
    displayForecast(appState.forecastList, currentData.timezone, currentData.dt);
    updateWeatherBackground(currentData);
    saveRecentSearch(currentData.name);
    displayRecentSearches();
  } catch (error) {
    if (error && error.name === 'AbortError') return;
    if (reqId !== appState.requestCounter) return;
    showError(error.message || 'Unable to fetch weather for your location.');
  } finally {
    if (reqId === appState.requestCounter) {
      showLoading(false);
    }
  }
}

async function handleApiResponse(response) {
  if (response.ok) {
    return response.json();
  }

  if (response.status === 404) {
    throw new Error('City not found. Please check the spelling.');
  }
  if (response.status === 401) {
    throw new Error('Invalid OpenWeatherMap API key.');
  }
  if (response.status === 429) {
    throw new Error('API rate limit exceeded. Please wait and try again.');
  }

  const body = await response.json().catch(() => ({}));
  throw new Error(body.message || 'Unexpected error from weather service.');
}

function getUserLocation() {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }

  showLoading(true);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      fetchWeatherByCoordinates(
        position.coords.latitude,
        position.coords.longitude
      );
    },
    (geoError) => {
      showLoading(false);
      if (geoError.code === geoError.PERMISSION_DENIED) {
        showError('Location permission denied. Search for any city manually.');
      } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
        showError('Your location is currently unavailable.');
      } else if (geoError.code === geoError.TIMEOUT) {
        showError('Location request timed out. Please try again.');
      } else {
        showError('Unable to detect your location.');
      }
    },
    { enableHighAccuracy: false, timeout: 10000 }
  );
}

function displayCurrentWeather(data) {
  const emptyState = document.getElementById('empty-state');
  const dashboard = document.getElementById('weather-dashboard');
  if (emptyState) emptyState.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');

  const condition = (data.weather && data.weather[0]) || {
    main: 'Clear',
    description: 'clear sky',
    icon: '01d',
  };

  setText('city-name', data.name || '--');
  setText('country-code', data.sys && data.sys.country ? data.sys.country : '');
  setText('local-datetime', formatLocalDateTime(data.dt, data.timezone));
  setText(
    'current-temp',
    `${convertTemperature(data.main.temp, appState.unit)}°${appState.unit}`
  );
  setText(
    'feels-like',
    `Feels like ${convertTemperature(data.main.feels_like, appState.unit)}°${appState.unit}`
  );
  setText('weather-condition', condition.main);
  setText('weather-description', condition.description);
  setText('weather-summary', `${condition.main} · ${condition.description}`);

  const iconEl = document.getElementById('weather-icon');
  if (iconEl) {
    iconEl.src = `https://openweathermap.org/img/wn/${condition.icon}@2x.png`;
    iconEl.alt = condition.description;
  }

  setText('metric-humidity', `${data.main.humidity}%`);
  setText('metric-wind', `${Number(data.wind.speed).toFixed(1)} m/s`);
  setText('metric-pressure', `${data.main.pressure} hPa`);
  setText(
    'metric-visibility',
    typeof data.visibility === 'number'
      ? `${(data.visibility / 1000).toFixed(1)} km`
      : '--'
  );
  setText(
    'metric-sunrise',
    data.sys && data.sys.sunrise
      ? formatSunTime(data.sys.sunrise, data.timezone)
      : '--'
  );
  setText(
    'metric-sunset',
    data.sys && data.sys.sunset
      ? formatSunTime(data.sys.sunset, data.timezone)
      : '--'
  );
}

function displayForecast(entries, timezoneOffset, currentDt) {
  const grid = document.getElementById('forecast-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const grouped = new Map();
  const todayKey = getLocalDateKey(currentDt, timezoneOffset);

  entries.forEach((entry) => {
    const dateKey = getLocalDateKey(entry.dt, timezoneOffset);
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey).push(entry);
  });

  const sortedKeys = Array.from(grouped.keys()).sort();
  const futureKeys = sortedKeys.filter((k) => k > todayKey);
  const targetKeys =
    futureKeys.length >= 5 ? futureKeys.slice(0, 5) : sortedKeys.slice(0, 5);

  targetKeys.forEach((dateKey) => {
    const dayEntries = grouped.get(dateKey);
    let maxTemp = -Infinity;
    let minTemp = Infinity;
    let representative = dayEntries[0];
    let bestHourDiff = Infinity;

    dayEntries.forEach((item) => {
      const hi = item.main.temp_max ?? item.main.temp;
      const lo = item.main.temp_min ?? item.main.temp;
      if (hi > maxTemp) maxTemp = hi;
      if (lo < minTemp) minTemp = lo;

      const localHour = new Date((item.dt + timezoneOffset) * 1000).getUTCHours();
      const diff = Math.abs(localHour - 12);
      if (diff < bestHourDiff) {
        bestHourDiff = diff;
        representative = item;
      }
    });

    const repDate = new Date((representative.dt + timezoneOffset) * 1000);
    const dayName = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(repDate);
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(repDate);

    const cond = (representative.weather && representative.weather[0]) || {
      main: 'Clear',
      description: 'clear sky',
      icon: '01d',
    };

    const card = document.createElement('article');
    card.className =
      'glass-card rounded-2xl p-4 sm:p-5 flex sm:flex-col items-center sm:items-stretch justify-between gap-3';

    const dateBlock = document.createElement('div');
    const dayP = document.createElement('p');
    dayP.className = 'font-display text-base font-semibold';
    dayP.textContent = dayName;
    const dateP = document.createElement('p');
    dateP.className = 'text-xs font-medium opacity-70';
    dateP.textContent = dateLabel;
    dateBlock.append(dayP, dateP);

    const iconBlock = document.createElement('div');
    iconBlock.className = 'flex items-center sm:flex-col sm:items-center gap-2 sm:py-1';
    const img = document.createElement('img');
    img.src = `https://openweathermap.org/img/wn/${cond.icon}@2x.png`;
    img.alt = cond.description;
    img.className = 'w-12 h-12 sm:w-16 sm:h-16 object-contain';
    const condP = document.createElement('p');
    condP.className = 'text-sm font-semibold sm:text-center';
    condP.textContent = cond.main;
    iconBlock.append(img, condP);

    const tempsBlock = document.createElement('div');
    tempsBlock.className = 'flex items-center justify-end sm:justify-between gap-3 pt-0 sm:pt-2 sm:border-t sm:border-current/10';
    const highSpan = document.createElement('span');
    highSpan.className = 'font-mono text-base sm:text-lg font-bold tabular-nums';
    highSpan.textContent = `${convertTemperature(maxTemp, appState.unit)}°${appState.unit}`;
    const lowSpan = document.createElement('span');
    lowSpan.className = 'font-mono text-base sm:text-lg font-medium tabular-nums opacity-75';
    lowSpan.textContent = `${convertTemperature(minTemp, appState.unit)}°${appState.unit}`;
    tempsBlock.append(highSpan, lowSpan);

    card.append(dateBlock, iconBlock, tempsBlock);
    grid.appendChild(card);
  });
}

function updateWeatherBackground(data) {
  const body = document.getElementById('app-body');
  if (!body) return;

  const conditionMain =
    data.weather && data.weather[0] ? data.weather[0].main.toLowerCase() : '';
  const sunrise = data.sys && data.sys.sunrise ? data.sys.sunrise : 0;
  const sunset = data.sys && data.sys.sunset ? data.sys.sunset : 0;
  const isNight =
    sunrise > 0 && sunset > 0 ? data.dt < sunrise || data.dt >= sunset : false;

  let themeClass = 'theme-clouds';
  if (conditionMain.includes('thunder')) {
    themeClass = 'theme-thunderstorm';
  } else if (conditionMain.includes('snow')) {
    themeClass = 'theme-snow';
  } else if (conditionMain.includes('rain') || conditionMain.includes('drizzle')) {
    themeClass = 'theme-rain';
  } else if (isNight) {
    themeClass = 'theme-night';
  } else if (conditionMain.includes('clear')) {
    themeClass = 'theme-clear';
  }

  body.className = `weather-bg ${themeClass} font-sans antialiased flex flex-col min-h-screen`;
}

function convertTemperature(celsius, unit) {
  if (unit === 'F') {
    return Math.round((celsius * 9) / 5 + 32);
  }
  return Math.round(celsius);
}

function toggleTemperatureUnit(nextUnit) {
  if (appState.unit === nextUnit) return;
  appState.unit = nextUnit;

  document.querySelectorAll('.unit-btn').forEach((btn) => {
    const btnUnit = btn.getAttribute('data-unit');
    if (btnUnit === nextUnit) {
      btn.classList.add('unit-btn-active');
    } else {
      btn.classList.remove('unit-btn-active');
    }
  });

  if (appState.currentWeather) {
    displayCurrentWeather(appState.currentWeather);
    displayForecast(
      appState.forecastList,
      appState.currentWeather.timezone,
      appState.currentWeather.dt
    );
  }
}

function saveRecentSearch(cityName) {
  const trimmed = (cityName || '').trim();
  if (!trimmed) return;

  const filtered = appState.recentSearches.filter(
    (item) => item.toLowerCase() !== trimmed.toLowerCase()
  );
  appState.recentSearches = [trimmed, ...filtered].slice(0, 5);
  localStorage.setItem(
    RECENT_STORAGE_KEY,
    JSON.stringify(appState.recentSearches)
  );
}

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      appState.recentSearches = parsed.slice(0, 5);
    }
  } catch {
    appState.recentSearches = [];
  }
}

function displayRecentSearches() {
  const nav = document.getElementById('recent-searches-nav');
  const list = document.getElementById('recent-searches-list');
  if (!nav || !list) return;

  list.innerHTML = '';
  if (appState.recentSearches.length === 0) {
    nav.classList.add('hidden');
    return;
  }

  nav.classList.remove('hidden');
  appState.recentSearches.forEach((city) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = city;
    btn.className =
      'h-8 px-3.5 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors cursor-pointer';
    btn.addEventListener('click', () => searchCity(city));
    list.appendChild(btn);
  });
}

function showLoading(isLoading) {
  const loader = document.getElementById('loading-container');
  const errorBox = document.getElementById('error-container');
  if (loader) {
    loader.classList.toggle('hidden', !isLoading);
  }
  if (isLoading && errorBox) {
    errorBox.classList.add('hidden');
  }
}

function showError(message) {
  const errorBox = document.getElementById('error-container');
  const errorMsg = document.getElementById('error-message');
  const toast = document.getElementById('error-toast');
  const toastMsg = document.getElementById('toast-message');

  if (errorBox && errorMsg) {
    errorMsg.textContent = message;
    errorBox.classList.remove('hidden');
  }

  if (toast && toastMsg) {
    toastMsg.textContent = message;
    toast.classList.remove('hidden');
    if (appState.toastTimer) clearTimeout(appState.toastTimer);
    appState.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 5000);
  }
}

function getLocalDateKey(dtSeconds, timezoneOffset) {
  const d = new Date((dtSeconds + timezoneOffset) * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalDateTime(dtSeconds, timezoneOffset) {
  const d = new Date((dtSeconds + timezoneOffset) * 1000);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(d);
}

function formatSunTime(unixSeconds, timezoneOffset) {
  const d = new Date((unixSeconds + timezoneOffset) * 1000);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(d);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
