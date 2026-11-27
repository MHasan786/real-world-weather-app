# WeatherNow — Live Global Weather Application

A responsive, real-time global weather and 5-day forecast dashboard with dynamic atmospheric themes, unit conversion (°C / °F), browser geolocation, and `localStorage` search history.

---

## Project Folder Structure

```text
weather-app/
├── index.html   # Semantic HTML5 layout + Tailwind CSS CDN
├── style.css    # Custom CSS3 gradients, glassmorphism, animations & media queries
├── script.js    # Vanilla ES6+ OpenWeatherMap API integration & UI logic
└── README.md    # Setup, deployment & verification guide
```

---

## OpenWeatherMap API Key Setup

1. Create a free account at [https://openweathermap.org/](https://openweathermap.org/).
2. Navigate to **My API Keys** in your account dashboard and generate or copy your key (new keys can take up to 15–30 minutes to activate).
3. Open `weather-app/script.js` and replace `YOUR_OPENWEATHERMAP_API_KEY` in the `API_KEY` constant:
   ```javascript
   const API_KEY = 'your_actual_api_key_here';
   ```

> **Production Security Warning:** Any API key placed in frontend JavaScript (`script.js`) is visible to visitors via browser DevTools or network inspection. For production deployments, keep your `OPENWEATHER_API_KEY` on a backend server or serverless proxy endpoint (such as `/api/weather`) so the secret key is never exposed to clients.

---

## Running Locally with VS Code Live Server

1. Open the `weather-app/` folder in Visual Studio Code.
2. Install the **Live Server** extension (`ritwickdey.LiveServer`).
3. Right-click `index.html` and select **Open with Live Server**.
4. Your browser will open `http://127.0.0.1:5500/index.html`. (Using Live Server instead of `file://` ensures browser Geolocation and `localStorage` operate properly.)

---

## Uploading to GitHub

```bash
cd weather-app
git init
git add index.html style.css script.js README.md
git commit -m "Initial commit: WeatherNow live global weather application"
git branch -M main
git remote add origin https://github.com/<your-username>/weathernow.git
git push -u origin main
```

---

## Deploying to GitHub Pages or Netlify

### GitHub Pages
1. Open your GitHub repository → **Settings** → **Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose the `main` branch and `/ (root)` folder, then click **Save**.
4. Your site will be published at `https://<your-username>.github.io/weathernow/`.

### Netlify
1. Log in to [https://app.netlify.com/](https://app.netlify.com/).
2. Click **Add new site** → **Import an existing project** (or drag and drop the `weather-app/` folder directly into Netlify Drop).
3. Leave build command empty and set publish directory to `.` (or `weather-app`).
4. Click **Deploy site**.

---

## Final Testing Checklist

- [ ] Search at least three different cities worldwide (e.g., Tokyo, London, Reykjavik).
- [ ] Confirm current weather data matches real-time conditions (no hardcoded values).
- [ ] Confirm 5-day forecast displays 5 calendar days with genuine daily highs and lows.
- [ ] Toggle `°C` ↔ `°F` and verify current, feels-like, and forecast temperatures recalculate accurately.
- [ ] Test **Use My Location** with browser location permission granted and denied.
- [ ] Refresh the page and verify recent search chips persist via `localStorage` (up to 5, latest first, no duplicates).
- [ ] Verify dynamic backgrounds respond to Clear, Clouds, Rain, Snow, Thunderstorm, and Night conditions.
- [ ] Search an invalid city name and verify `"City not found. Please check the spelling."` displays cleanly.
- [ ] Verify responsive layout at `360px` (mobile), `768px` (tablet), `1200px` (desktop), and `1440px` (large desktop) with zero horizontal overflow.
- [ ] Confirm browser console is free of JavaScript errors.
