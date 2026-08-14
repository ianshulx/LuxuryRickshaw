/* ==========================================================================
   लग्जरी रिक्शा — cinematic music player
   Vanilla JS. No frameworks, no build step. Firebase Realtime Database is
   used only for two live counters (online presence, playlist likes).
   OpenWeatherMap is used only for the weather chip + rain effect.

   Architecture:
     initializeApp            – boots everything on DOMContentLoaded
     loadYouTubeAPI            – injects the IFrame API script once
     createYouTubePlayer       – instantiates the hidden YT.Player
     handlePlayerReady         – first-load bookkeeping
     handlePlayerStateChange   – reacts to play/pause/buffer/end/cue
     handlePlayerError         – user-friendly error states
     updateSongMetadata        – title / subtitle / artist / thumbnail
     updateProgress            – rAF-driven waveform fill + time labels
     seekTo / togglePlayPause / playNext / playPrevious
     updateUI                  – small DOM sync helpers
     updateBackground          – optional per-song background wash
     formatTime                 – mm:ss helper
     initPresence               – real "online now" count via Firebase
     initLikes                  – real "likes" count via Firebase
     initWeather                – geolocation + OpenWeatherMap + rain effect
     initQueue                  – swipeable "up next" drawer
     initArtSwipe                – drag/swipe on album art for prev/next
   ========================================================================== */

/* ==========================================================================
   1. CONFIGURATION
   ========================================================================== */

const CONFIG = {
  playlistId: "PLcrE2_0C5h0wplMKN7ZvNJpwSuj-H0Y-C",

  heroTitle: "लग्जरी रिक्शा",
  showHeroTitle: true,

  youtubeMusicUrl: "https://music.youtube.com/playlist?list=PLcrE2_0C5h0wplMKN7ZvNJpwSuj-H0Y-C",
  instagramUrl: "https://www.instagram.com/arion.core",
  githubUrl: "https://github.com/ianshulx/LuxuryRickshaw",

  showOnlineCount: true,
  onlineCount: 462, // shown briefly before the first live Firebase snapshot arrives

  backgroundImage: "assets/bg.webp",
  backgroundImageMobile: "assets/bg-mobile.webp",
  dynamicBackground: false,

  autoplay: false,

  // Weather chip + rain effect. Falls back to this fixed location if the
  // visitor declines geolocation or their browser doesn't support it.
  weatherApiKey: "ec5208a9b5473bcb00997fd41558a5f4",
  fallbackLocationName: "Manali",
  fallbackLat: 32.2432,
  fallbackLon: 77.1892,
  useGeolocation: true,
  weatherRefreshMinutes: 20,

  waveformBarCount: 56,
};

/* ==========================================================================
   1b. FIREBASE — presence count + like count
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCmnxFyJarwNRsXEXt-eTp7BAQcFrT39fM",
  authDomain: "rickshaw-10933.firebaseapp.com",
  databaseURL: "https://rickshaw-10933-default-rtdb.firebaseio.com",
  projectId: "rickshaw-10933",
  storageBucket: "rickshaw-10933.firebasestorage.app",
  messagingSenderId: "301375252455",
  appId: "1:301375252455:web:6c11bde4c6979e5048ff42",
};

/* ==========================================================================
   2. STATE
   ========================================================================== */

const state = {
  player: null,
  playerReady: false,
  isPlaying: false,
  duration: 0,
  currentVideoId: null,
  isSeeking: false,
  metadataRetryTimer: null,
  queueIds: [],
  queueMeta: {},
  queueOpen: false,
  repeatOne: false,
  consecutiveErrors: 0,
  hasLiked: false,
  likeRef: null,
  firebaseApp: null,
  manualLocation: null,
  locationSearchOpen: false,
};

/* ==========================================================================
   3. DOM REFERENCES
   ========================================================================== */

const el = {};

function cacheDom() {
  el.clock = document.getElementById("clock");
  el.weatherIcon = document.getElementById("weatherIcon");
  el.locationName = document.getElementById("locationName");
  el.locationChip = document.getElementById("locationChip");
  el.locationSearchBackdrop = document.getElementById("locationSearchBackdrop");
  el.locationSearchPanel = document.getElementById("locationSearchPanel");
  el.locationSearchInput = document.getElementById("locationSearchInput");
  el.locationSearchResults = document.getElementById("locationSearchResults");
  el.locationSearchClose = document.getElementById("locationSearchClose");
  el.rainLayer = document.getElementById("rainLayer");

  el.likeBtn = document.getElementById("likeBtn");
  el.likeCount = document.getElementById("likeCount");
  el.onlinePill = document.getElementById("onlinePill");
  el.onlineCount = document.getElementById("onlineCount");
  el.ytMusicLink = document.getElementById("ytMusicLink");
  el.instagramLink = document.getElementById("instagramLink");
  el.githubLink = document.getElementById("githubLink");
  el.heroTitle = document.getElementById("heroTitle");
  el.statusBanner = document.getElementById("statusBanner");
  el.toast = document.getElementById("toast");

  el.bgPhoto = document.getElementById("bgPhoto");
  el.bgPhotoMobile = document.getElementById("bgPhotoMobile");
  el.bgPhotoDynamic = document.getElementById("bgPhotoDynamic");
  el.rowFar = document.getElementById("rowFarBuildings");
  el.rowMid = document.getElementById("rowMidBuildings");
  el.rowNear = document.getElementById("rowNearBuildings");
  el.stringBulbs = document.querySelector(".string-bulbs");

  el.player = document.getElementById("player");
  el.artSwipeArea = document.getElementById("artSwipeArea");
  el.albumArt = document.getElementById("albumArt");
  el.swipeHintLeft = document.getElementById("swipeHintLeft");
  el.swipeHintRight = document.getElementById("swipeHintRight");

  el.trackTitle = document.getElementById("trackTitle");
  el.trackSubtitle = document.getElementById("trackSubtitle");
  el.trackArtist = document.getElementById("trackArtist");

  el.currentTime = document.getElementById("currentTime");
  el.durationTime = document.getElementById("durationTime");
  el.progressTrack = document.getElementById("progressTrack");
  el.waveformBars = document.getElementById("waveformBars");
  el.progressFillMask = document.getElementById("progressFillMask");
  el.progressHandle = document.getElementById("progressHandle");

  el.repeatBtn = document.getElementById("repeatBtn");
  el.prevBtn = document.getElementById("prevBtn");
  el.playBtn = document.getElementById("playBtn");
  el.nextBtn = document.getElementById("nextBtn");
  el.iconPlay = document.getElementById("iconPlay");
  el.iconPause = document.getElementById("iconPause");

  el.queueBtn = document.getElementById("queueBtn");
  el.queuePanel = document.getElementById("queuePanel");
  el.queueBackdrop = document.getElementById("queueBackdrop");
  el.queueCloseBtn = document.getElementById("queueCloseBtn");
  el.queueHandle = document.getElementById("queueHandle");
  el.queueList = document.getElementById("queueList");
  el.queueSearchInput = document.getElementById("queueSearchInput");
  el.queueSearchClear = document.getElementById("queueSearchClear");
  el.queueSearchEmpty = document.getElementById("queueSearchEmpty");
}

/* ==========================================================================
   4. BOOT
   ========================================================================== */

function initializeApp() {
  cacheDom();
  initClock();
  initServiceLinks();
  initHeroTitle();
  initOnlinePill();
  initPresence();
  initLikes();
  initWeather();
  initLocationSearch();
  initBackgroundPhoto();
  generateIllustration();
  generateWaveform();
  initControls();
  initProgressBarInteraction();
  initKeyboardControls();
  initQueue();
  initArtSwipe();
  initMediaSession();

  showStatus("Loading playlist…", { loading: true });
  loadYouTubeAPI();
}

document.addEventListener("DOMContentLoaded", initializeApp);

/* ==========================================================================
   5. CLOCK
   ========================================================================== */

function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  el.clock.textContent = `${hours}:${minutes} ${period}`;
}

/* ==========================================================================
   6. SERVICE / SOCIAL LINKS
   ========================================================================== */

function initServiceLinks() {
  el.ytMusicLink.href = CONFIG.youtubeMusicUrl;
  el.instagramLink.href = CONFIG.instagramUrl;
  el.githubLink.href = CONFIG.githubUrl;
}

function initOnlinePill() {
  if (!CONFIG.showOnlineCount) {
    el.onlinePill.style.display = "none";
    return;
  }
  el.onlineCount.textContent = CONFIG.onlineCount;
}

/* ==========================================================================
   6b. PRESENCE — real "online now" count via Firebase Realtime Database
   ========================================================================== */

function getFirebaseApp() {
  if (state.firebaseApp) return state.firebaseApp;
  if (typeof firebase === "undefined") {
    console.warn("[firebase] SDK not loaded — check the <script> tags in index.html.");
    return null;
  }
  state.firebaseApp = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  return state.firebaseApp;
}

function initPresence() {
  if (!CONFIG.showOnlineCount) return;
  const app = getFirebaseApp();
  if (!app) return;

  const db = firebase.database();
  const myPresenceRef = db.ref("presence").push();
  const connectedRef = db.ref(".info/connected");

  connectedRef.on("value", (snap) => {
    if (snap.val() === true) {
      myPresenceRef.onDisconnect().remove();
      myPresenceRef.set(true);
    }
  });

  db.ref("presence").on("value", (snap) => {
    if (el.onlineCount) el.onlineCount.textContent = snap.numChildren();
  });
}

/* ==========================================================================
   6c. LIKES — real "like this playlist" count via Firebase
   ========================================================================== */

function initLikes() {
  const app = getFirebaseApp();
  if (!app) return;

  const db = firebase.database();
  const countRef = db.ref("likes/count");
  const localKey = "rickshaw_liked_" + CONFIG.playlistId;

  countRef.on("value", (snap) => {
    const value = snap.val();
    el.likeCount.textContent = typeof value === "number" ? value : 0;
  });

  state.hasLiked = localStorage.getItem(localKey) === "1";
  updateLikeButtonUI();

  el.likeBtn.addEventListener("click", () => {
    if (state.hasLiked) {
      countRef.transaction((current) => Math.max(0, (current || 0) - 1));
      localStorage.removeItem(localKey);
      state.hasLiked = false;
    } else {
      countRef.transaction((current) => (current || 0) + 1);
      localStorage.setItem(localKey, "1");
      state.hasLiked = true;
    }
    updateLikeButtonUI();
  });
}

function updateLikeButtonUI() {
  el.likeBtn.classList.toggle("is-liked", state.hasLiked);
  el.likeBtn.setAttribute("aria-pressed", String(state.hasLiked));
  el.likeBtn.title = state.hasLiked ? "Unlike this playlist" : "Like this playlist";
}

/* ==========================================================================
   6d. WEATHER — geolocation + OpenWeatherMap + rain effect
   ========================================================================== */

// OpenWeatherMap "id" ranges: 2xx thunderstorm, 3xx drizzle, 5xx rain,
// 6xx snow, 7xx atmosphere/mist, 800 clear, 80x clouds.
function weatherIconFor(id, isNight) {
  if (id >= 200 && id < 300) return "⛈️";
  if (id >= 300 && id < 400) return "🌦️";
  if (id >= 500 && id < 600) return "🌧️";
  if (id >= 600 && id < 700) return "❄️";
  if (id >= 700 && id < 800) return "🌫️";
  if (id === 800) return isNight ? "🌙" : "☀️";
  if (id > 800) return "⛅";
  return "⛅";
}

function isRainyCondition(id) {
  return (id >= 200 && id < 600) || (id >= 200 && id < 300);
}

const LOCATION_STORAGE_KEY = "rickshaw_manual_location";

function initWeather() {
  if (!CONFIG.weatherApiKey) return;

  try {
    const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.lat === "number" && typeof parsed.lon === "number") {
        state.manualLocation = parsed;
      }
    }
  } catch (err) {
    /* corrupt or unavailable storage — fall back to geolocation */
  }

  refreshWeather();
  setInterval(refreshWeather, CONFIG.weatherRefreshMinutes * 60 * 1000);
}

function refreshWeather() {
  if (state.manualLocation) {
    fetchWeather(state.manualLocation.lat, state.manualLocation.lon, state.manualLocation.name);
    return;
  }

  if (CONFIG.useGeolocation && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, null),
      () => fetchWeather(CONFIG.fallbackLat, CONFIG.fallbackLon, CONFIG.fallbackLocationName),
      { timeout: 6000, maximumAge: 10 * 60 * 1000 }
    );
  } else {
    fetchWeather(CONFIG.fallbackLat, CONFIG.fallbackLon, CONFIG.fallbackLocationName);
  }
}

function fetchWeather(lat, lon, knownName) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${CONFIG.weatherApiKey}`;

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("weather request failed: " + res.status);
      return res.json();
    })
    .then((data) => {
      const id = data.weather && data.weather[0] ? data.weather[0].id : 800;
      const isNight = data.weather && data.weather[0] ? data.weather[0].icon.endsWith("n") : false;
      const cityName = knownName || data.name || CONFIG.fallbackLocationName;

      el.locationName.textContent = cityName;
      el.weatherIcon.textContent = weatherIconFor(id, isNight);
      el.weatherIcon.title = data.weather && data.weather[0] ? data.weather[0].description : "";

      toggleRain(isRainyCondition(id));
    })
    .catch((err) => {
      console.warn("[weather] Could not fetch weather:", err.message);
      el.locationName.textContent = knownName || CONFIG.fallbackLocationName;
    });
}

let rainBuilt = false;

function toggleRain(shouldShow) {
  if (shouldShow && !rainBuilt) buildRain();
  el.rainLayer.classList.toggle("is-active", shouldShow);
}

function buildRain() {
  rainBuilt = true;
  const dropCount = 90;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < dropCount; i++) {
    const drop = document.createElement("div");
    drop.className = "raindrop";
    const left = Math.random() * 100;
    const duration = 0.6 + Math.random() * 0.7;
    const delay = Math.random() * 2;
    const height = 40 + Math.random() * 50;
    drop.style.left = left + "%";
    drop.style.height = height + "px";
    drop.style.animationDuration = duration + "s";
    drop.style.animationDelay = delay + "s";
    frag.appendChild(drop);
  }
  el.rainLayer.appendChild(frag);
}

/* ==========================================================================
   6e. LOCATION SEARCH — pick weather for any place, by name
   ========================================================================== */

function initLocationSearch() {
  if (!el.locationChip || !el.locationSearchPanel) return;

  el.locationChip.addEventListener("click", openLocationSearch);
  el.locationSearchClose.addEventListener("click", closeLocationSearch);
  el.locationSearchBackdrop.addEventListener("click", closeLocationSearch);

  let debounceTimer = null;
  el.locationSearchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = el.locationSearchInput.value.trim();
    if (query.length < 2) {
      el.locationSearchResults.innerHTML = "";
      return;
    }
    debounceTimer = setTimeout(() => runLocationSearch(query), 350);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.locationSearchOpen) closeLocationSearch();
  });
}

function openLocationSearch() {
  state.locationSearchOpen = true;
  el.locationSearchPanel.classList.add("is-open");
  el.locationSearchBackdrop.classList.add("is-open");
  el.locationSearchPanel.setAttribute("aria-hidden", "false");
  el.locationChip.setAttribute("aria-expanded", "true");
  el.locationSearchInput.value = "";
  el.locationSearchResults.innerHTML = "";
  setTimeout(() => el.locationSearchInput.focus(), 50);
}

function closeLocationSearch() {
  state.locationSearchOpen = false;
  el.locationSearchPanel.classList.remove("is-open");
  el.locationSearchBackdrop.classList.remove("is-open");
  el.locationSearchPanel.setAttribute("aria-hidden", "true");
  el.locationChip.setAttribute("aria-expanded", "false");
}

function geocodeSearch(query) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=6&appid=${CONFIG.weatherApiKey}`;
  return fetch(url)
    .then((res) => (res.ok ? res.json() : []))
    .catch(() => []);
}

function runLocationSearch(query) {
  el.locationSearchResults.innerHTML = `<li class="location-result-status">Searching…</li>`;

  geocodeSearch(query).then((results) => {
    // The panel may have been closed, or the input changed, while this was
    // in flight — only render if it's still the latest query in the box.
    if (el.locationSearchInput.value.trim() !== query) return;

    if (!Array.isArray(results) || results.length === 0) {
      el.locationSearchResults.innerHTML = `<li class="location-result-status">No matches found.</li>`;
      return;
    }

    el.locationSearchResults.innerHTML = "";
    results.forEach((place) => {
      const label = [place.name, place.state, place.country].filter(Boolean).join(", ");
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "location-result-row";
      btn.textContent = label;
      btn.addEventListener("click", () => selectSearchedLocation(place, label));
      li.appendChild(btn);
      el.locationSearchResults.appendChild(li);
    });
  });
}

function selectSearchedLocation(place, label) {
  const displayName = place.name || label;
  state.manualLocation = { lat: place.lat, lon: place.lon, name: displayName };

  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(state.manualLocation));
  } catch (err) {
    /* localStorage unavailable — the choice just won't persist across reloads */
  }

  fetchWeather(place.lat, place.lon, displayName);
  closeLocationSearch();
  showToast(`Weather set to ${displayName}`);
}

/* ==========================================================================
   7. HERO TITLE
   ========================================================================== */

function initHeroTitle() {
  if (!CONFIG.showHeroTitle || !CONFIG.heroTitle) {
    el.heroTitle.classList.add("is-hidden");
    return;
  }
  el.heroTitle.textContent = CONFIG.heroTitle;
}

/* ==========================================================================
   8. BACKGROUND — static photo + procedural illustration
   ========================================================================== */

function initBackgroundPhoto() {
  if (!CONFIG.backgroundImage && !CONFIG.backgroundImageMobile) return;

  const mobileQuery = window.matchMedia("(max-width: 620px)");

  function loadInto(targetEl, src) {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      targetEl.style.backgroundImage = `url("${src}")`;
      targetEl.classList.add("is-visible");
      document.getElementById("bgIllustration").style.opacity = "0";
    };
    img.onerror = () => {
      console.warn(`[player] Could not load background "${src}".`);
    };
    img.src = src;
  }

function applyForViewport() {
  const useMobile = mobileQuery.matches && CONFIG.backgroundImageMobile;
  const src = useMobile ? CONFIG.backgroundImageMobile : CONFIG.backgroundImage;
  const targetEl = useMobile ? el.bgPhotoMobile : el.bgPhoto;
  const otherEl = useMobile ? el.bgPhoto : el.bgPhotoMobile;

  if (!src) return;

  otherEl.classList.remove("is-visible");

  if (targetEl.style.backgroundImage.includes(src)) {
    // Bytes are already loaded on this element from an earlier viewport
    // switch — just re-show it, no need to re-fetch/decode the image.
    targetEl.classList.add("is-visible");
    return;
  }

  loadInto(targetEl, src);
}

  applyForViewport();
  mobileQuery.addEventListener("change", applyForViewport);
}

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateBuildingRow(group, rand, opts) {
  if (!group) return;
  const { baseline, minH, maxH, minW, maxW, gap, windows } = opts;
  let x = -20;
  const svgNS = "http://www.w3.org/2000/svg";
  while (x < 1620) {
    const w = minW + rand() * (maxW - minW);
    const h = minH + rand() * (maxH - minH);
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", x.toFixed(1));
    rect.setAttribute("y", (baseline - h).toFixed(1));
    rect.setAttribute("width", w.toFixed(1));
    rect.setAttribute("height", (h + 40).toFixed(1));
    rect.setAttribute("rx", "2");
    group.appendChild(rect);

    if (windows) {
      const cols = Math.max(1, Math.floor(w / 22));
      const rows = Math.max(1, Math.floor(h / 26));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rand() > 0.45) continue;
          const wx = x + 8 + c * 22;
          const wy = baseline - h + 12 + r * 26;
          const win = document.createElementNS(svgNS, "rect");
          win.setAttribute("x", wx.toFixed(1));
          win.setAttribute("y", wy.toFixed(1));
          win.setAttribute("width", "6");
          win.setAttribute("height", "9");
          win.setAttribute("rx", "1");
          win.setAttribute("fill", "#f3b25a");
          win.setAttribute("opacity", (0.25 + rand() * 0.35).toFixed(2));
          group.appendChild(win);
        }
      }
    }

    x += w + gap + rand() * gap;
  }
}

function generateStringBulbs() {
  if (!el.stringBulbs) return;
  const svgNS = "http://www.w3.org/2000/svg";
  const count = 26;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const x = t * 1600;
    const y = 90 + 70 * Math.sin(Math.PI * t) + 20 * Math.sin(Math.PI * t * 2);
    const bulb = document.createElementNS(svgNS, "circle");
    bulb.setAttribute("cx", x.toFixed(1));
    bulb.setAttribute("cy", y.toFixed(1));
    bulb.setAttribute("r", "3.2");
    el.stringBulbs.appendChild(bulb);
  }
}

function generateIllustration() {
  const rand = seededRandom(1337);
  generateBuildingRow(el.rowFar, rand, { baseline: 620, minH: 90, maxH: 190, minW: 50, maxW: 110, gap: 6, windows: false });
  generateBuildingRow(el.rowMid, rand, { baseline: 700, minH: 130, maxH: 260, minW: 60, maxW: 130, gap: 8, windows: true });
  generateBuildingRow(el.rowNear, rand, { baseline: 900, minH: 160, maxH: 340, minW: 70, maxW: 160, gap: 10, windows: true });
  generateStringBulbs();
}

function updateBackground(videoId) {
  if (!CONFIG.dynamicBackground || !videoId) return;
  loadBestThumbnail(videoId, (url) => {
    el.bgPhotoDynamic.style.backgroundImage = `url("${url}")`;
    el.bgPhotoDynamic.classList.add("is-visible");
  });
}

/* ==========================================================================
   8b. DECORATIVE WAVEFORM
   ========================================================================== */

// Not tied to real audio — YouTube's cross-origin iframe never exposes its
// audio stream to this page, so a true audio-reactive waveform isn't
// technically possible here. This generates a fixed, natural-looking bar
// pattern once, then animates each bar's height with a staggered CSS-driven
// pulse while playing, reusing the same bars (cloned) as the progress fill.
function generateWaveform() {
  const rand = seededRandom(42);
  const count = CONFIG.waveformBarCount;
  el.waveformBars.innerHTML = "";

  const heights = [];
  for (let i = 0; i < count; i++) {
    heights.push(0.25 + rand() * 0.75);
  }

  heights.forEach((h, i) => {
    const bar = document.createElement("span");
    bar.style.height = Math.round(h * 100) + "%";
    bar.dataset.baseHeight = h;
    bar.style.animationDelay = (i * 37) % 900 + "ms";
    el.waveformBars.appendChild(bar);
  });

  // Clone into the fill mask so the "played" portion renders in gold over
  // the same bar shapes, clipped by width via progress-fill-mask.
  const clone = document.createElement("div");
  clone.className = "waveform-bars-clone";
  heights.forEach((h) => {
    const bar = document.createElement("span");
    bar.style.height = Math.round(h * 100) + "%";
    clone.appendChild(bar);
  });
  el.progressFillMask.innerHTML = "";
  el.progressFillMask.appendChild(clone);
}

let waveformPulseId = null;
let waveformLastPaint = null;

// PERF: this used to write `style.height` on all 56 bars every single
// animation frame (~3,360 DOM writes/sec) for the entire duration of
// playback. `height` is a layout property, so each write forced a reflow —
// continuous layout thrashing purely for a decorative wobble. Fixed by:
//   1) throttling the paint to ~12fps (still looks smooth for a slow wobble)
//   2) animating `transform: scaleY()` instead of `height` — transforms are
//      handled on the compositor and never trigger layout/paint.
function startWaveformPulse() {
  if (waveformPulseId) return;
  const bars = el.waveformBars.querySelectorAll("span");
  const baseHeights = Array.from(bars, (bar) => parseFloat(bar.dataset.baseHeight) || 0.5);
  let t = 0;

  const tick = (timestamp) => {
    if (!waveformLastPaint || timestamp - waveformLastPaint > 80) {
      t += 1;
      for (let i = 0; i < bars.length; i++) {
        const base = baseHeights[i];
        const wobble = Math.sin(t * 0.15 + i * 0.6) * 0.18;
        const h = Math.max(0.12, Math.min(1, base + wobble));
        bars[i].style.transform = `scaleY(${(h / base).toFixed(3)})`;
      }
      waveformLastPaint = timestamp;
    }
    waveformPulseId = requestAnimationFrame(tick);
  };
  waveformPulseId = requestAnimationFrame(tick);
}

function stopWaveformPulse() {
  if (waveformPulseId) {
    cancelAnimationFrame(waveformPulseId);
    waveformPulseId = null;
    waveformLastPaint = null;
  }
  const bars = el.waveformBars.querySelectorAll("span");
  bars.forEach((bar) => {
    bar.style.transform = "";
  });
}

/* ==========================================================================
   9. THUMBNAIL LOADING WITH FALLBACK CHAIN
   ========================================================================== */

// PERF: every song change fires up to three independent calls to this
// function for the same videoId — setAlbumArtwork, updateMediaSessionMetadata,
// and (already-loaded) queue rows. Each call used to re-run the full
// probe-every-size-over-the-network chain from scratch. A small in-memory
// cache means the network/probe chain only runs once per video per session.
const thumbnailCache = {};

function loadBestThumbnail(videoId, onSuccess, onFailure) {
  if (thumbnailCache[videoId]) {
    onSuccess(thumbnailCache[videoId]);
    return;
  }

  const sizes = ["maxresdefault", "hqdefault", "mqdefault", "default"];
  let i = 0;

  function tryNext() {
    if (i >= sizes.length) {
      if (onFailure) onFailure();
      return;
    }
    const url = `https://img.youtube.com/vi/${videoId}/${sizes[i]}.jpg`;
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth <= 120 && sizes[i] !== "default") {
        i += 1;
        tryNext();
        return;
      }
      thumbnailCache[videoId] = url;
      onSuccess(url);
    };
    probe.onerror = () => {
      i += 1;
      tryNext();
    };
    probe.src = url;
  }

  tryNext();
}

function setAlbumArtwork(videoId) {
  loadBestThumbnail(
    videoId,
    (url) => {
      el.albumArt.src = url;
      el.albumArt.alt = el.trackTitle.textContent;
    },
    () => {
      el.albumArt.removeAttribute("src");
    }
  );
}

/* ==========================================================================
   10. YOUTUBE IFRAME API
   ========================================================================== */

function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) {
    createYouTubePlayer();
    return;
  }
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  tag.onerror = () => showStatus("Unable to connect to YouTube.", { error: true });
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = createYouTubePlayer;
}

function createYouTubePlayer() {
  state.player = new YT.Player("youtube-player", {
    height: "1",
    width: "1",
    playerVars: {
      listType: "playlist",
      list: CONFIG.playlistId,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      disablekb: 1,
      iv_load_policy: 3,
      origin: window.location.origin,
    },
    events: {
      onReady: handlePlayerReady,
      onStateChange: handlePlayerStateChange,
      onError: handlePlayerError,
    },
  });
}

function handlePlayerReady(event) {
  state.playerReady = true;

  const playlist = state.player.getPlaylist();
  if (!playlist || playlist.length === 0) {
    showStatus("Playlist not found. Check CONFIG.playlistId in script.js.", { error: true });
    return;
  }

  hideStatus();
  refreshMetadataWithRetry();
  buildQueueList(playlist);

  if (CONFIG.autoplay) {
    state.player.playVideo();
  }
}

function handlePlayerStateChange(event) {
  const YTState = window.YT.PlayerState;

  switch (event.data) {
    case YTState.PLAYING:
      state.isPlaying = true;
      state.duration = state.player.getDuration() || 0;
      state.consecutiveErrors = 0;
      updateUI();
      refreshMetadataWithRetry();
      startProgressLoop();
      startWaveformPulse();
      updateMediaSessionPlaybackState(true);
      highlightCurrentQueueRow();
      hideStatus();
      break;

    case YTState.PAUSED:
      state.isPlaying = false;
      updateUI();
      stopProgressLoop();
      stopWaveformPulse();
      updateMediaSessionPlaybackState(false);
      highlightCurrentQueueRow();
      break;

    case YTState.BUFFERING:
      state.isPlaying = false;
      updateUI();
      break;

    case YTState.CUED:
      state.isPlaying = false;
      updateUI();
      refreshMetadataWithRetry();
      break;

    case YTState.ENDED:
      if (state.repeatOne) {
        state.player.seekTo(0, true);
        state.player.playVideo();
        break;
      }
      state.isPlaying = false;
      updateUI();
      refreshMetadataWithRetry();
      break;

    default:
      break;
  }
}

function handlePlayerError(event) {
  const messages = {
    2: "This video can't be played.",
    5: "A playback error occurred.",
    100: "This video was removed or is private.",
    101: "This video can't be played here.",
    150: "This video can't be played here.",
  };
  const message = messages[event.data] || "Something went wrong with playback.";

  state.consecutiveErrors += 1;

  const playlist = state.player && state.player.getPlaylist ? state.player.getPlaylist() : null;
  const playlistLength = playlist ? playlist.length : 0;

  // Once we've failed 3 times in a row, the per-track message stops being
  // useful — switch to a broader banner. Note this no longer halts playback
  // (see below): it used to give up entirely here, leaving the player
  // permanently stuck even when later tracks were perfectly playable.
  if (state.consecutiveErrors >= 3) {
    showStatus("Several tracks in this playlist can't be played. Skipping ahead…", { error: true });
  } else {
    showStatus(message, { error: true, autoHide: true });
  }

  // Keep skipping forward as long as we haven't already struck out on every
  // track in the playlist — a bad run of unplayable videos shouldn't
  // permanently freeze the player. Only stop once the number of consecutive
  // failures reaches the playlist length, i.e. nothing is left to try.
  if (playlist && playlist.length > 1 && state.consecutiveErrors < playlistLength) {
    setTimeout(() => {
      playNext();
    }, 1200);
  } else if (playlist && playlistLength > 0 && state.consecutiveErrors >= playlistLength) {
    showStatus("None of the tracks in this playlist could be played. Check CONFIG.playlistId.", { error: true });
  }
}

/* ==========================================================================
   11. METADATA
   ========================================================================== */

function refreshMetadataWithRetry(attempt) {
  attempt = attempt || 0;
  clearTimeout(state.metadataRetryTimer);
  state.metadataRetryTimer = null;

  if (!state.player || !state.player.getVideoData) return;

  const data = state.player.getVideoData();

  if (data && data.title) {
    updateSongMetadata(data);
    return;
  }

  if (attempt < 6) {
    state.metadataRetryTimer = setTimeout(() => {
      refreshMetadataWithRetry(attempt + 1);
    }, 300);
  }
}

// Splits a YouTube title like: Khuda Jaane (From "Bachna Ae Haseeno")
// into a title line + a parenthetical subtitle line, when present.
function splitTitleAndSubtitle(rawTitle) {
  const match = rawTitle.match(/^(.*?)\s*[\(\[]([^)\]]+)[\)\]]\s*$/);
  if (match) {
    return { title: match[1].trim(), subtitle: match[2].trim() };
  }
  return { title: rawTitle, subtitle: "" };
}

function updateSongMetadata(data) {
  if (!data || !data.video_id) return;
  if (data.video_id === state.currentVideoId) return;

  state.currentVideoId = data.video_id;

  const fullTitle = data.title || "Untitled";
  const author = data.author || "";
  const { title, subtitle } = splitTitleAndSubtitle(fullTitle);
  el.trackTitle.textContent = title;
  el.trackTitle.title = data.title || "";
  el.trackSubtitle.textContent = subtitle;
  el.trackArtist.textContent = author;

  setAlbumArtwork(data.video_id);
  updateBackground(data.video_id);
  updateTabTitle(fullTitle);
  updateMediaSessionMetadata(fullTitle, author, data.video_id);

  state.queueMeta[data.video_id] = { title: fullTitle, author: author || "Unknown artist" };
  refreshQueueRow(data.video_id);
  highlightCurrentQueueRow();
}

/* ==========================================================================
   11b. TAB TITLE
   ========================================================================== */

const DEFAULT_TAB_TITLE = document.title;

function updateTabTitle(trackTitle) {
  document.title = trackTitle ? `${trackTitle} — ${CONFIG.heroTitle || DEFAULT_TAB_TITLE}` : DEFAULT_TAB_TITLE;
}

/* ==========================================================================
   11c. MEDIA SESSION — lock-screen / notification playback controls
   ========================================================================== */

function initMediaSession() {
  if (!("mediaSession" in navigator)) return;

  navigator.mediaSession.setActionHandler("play", () => state.player && state.player.playVideo());
  navigator.mediaSession.setActionHandler("pause", () => state.player && state.player.pauseVideo());
  navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
  navigator.mediaSession.setActionHandler("nexttrack", playNext);
}

function updateMediaSessionMetadata(title, author, videoId) {
  if (!("mediaSession" in navigator)) return;

  loadBestThumbnail(
    videoId,
    (url) => {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: author,
        artwork: [{ src: url, sizes: "512x512", type: "image/jpeg" }],
      });
    },
    () => {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: author });
    }
  );
}

function updateMediaSessionPlaybackState(isPlaying) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
}

/* ==========================================================================
   12. PLAYBACK CONTROLS
   ========================================================================== */

function initControls() {
  el.playBtn.addEventListener("click", togglePlayPause);
  el.prevBtn.addEventListener("click", playPrevious);
  el.nextBtn.addEventListener("click", playNext);
  el.repeatBtn.addEventListener("click", toggleRepeat);
}

function toggleRepeat() {
  state.repeatOne = !state.repeatOne;
  el.repeatBtn.classList.toggle("is-active", state.repeatOne);
  el.repeatBtn.setAttribute("aria-pressed", String(state.repeatOne));
  el.repeatBtn.setAttribute("aria-label", state.repeatOne ? "Repeat on" : "Repeat off");
  el.repeatBtn.title = state.repeatOne ? "Repeat: on" : "Repeat: off";
}

function togglePlayPause() {
  if (!state.player || !state.playerReady) return;
  if (state.isPlaying) {
    state.player.pauseVideo();
  } else {
    state.player.playVideo();
  }
}

function playNext() {
  if (!state.player || !state.playerReady) return;
  state.player.nextVideo();
}

function playPrevious() {
  if (!state.player || !state.playerReady) return;
  const elapsed = state.player.getCurrentTime ? state.player.getCurrentTime() : 0;
  if (elapsed > 3) {
    state.player.seekTo(0, true);
  } else {
    state.player.previousVideo();
  }
}

function seekTo(fractionOrSeconds, isFraction) {
  if (!state.player || !state.duration) return;
  const seconds = isFraction ? fractionOrSeconds * state.duration : fractionOrSeconds;
  state.player.seekTo(Math.max(0, Math.min(seconds, state.duration)), true);
}

/* ==========================================================================
   13. PROGRESS (waveform fill + time labels)
   ========================================================================== */

function startProgressLoop() {
  if (state.progressRafId) return;
  const tick = (timestamp) => {
    if (!state.isPlaying) {
      state.progressRafId = null;
      return;
    }
    if (!state.isSeeking && (!state.lastProgressPaint || timestamp - state.lastProgressPaint > 200)) {
      updateProgress();
      state.lastProgressPaint = timestamp;
    }
    state.progressRafId = requestAnimationFrame(tick);
  };
  state.progressRafId = requestAnimationFrame(tick);
}

function stopProgressLoop() {
  if (state.progressRafId) {
    cancelAnimationFrame(state.progressRafId);
    state.progressRafId = null;
  }
}

function updateProgress() {
  if (!state.player || !state.player.getCurrentTime) return;
  const current = state.player.getCurrentTime() || 0;
  const duration = state.player.getDuration() || state.duration || 0;
  state.duration = duration;
  paintProgress(current, duration);
}

function paintProgress(current, duration) {
  const pct = duration > 0 ? (current / duration) * 100 : 0;
  el.progressFillMask.style.width = `${pct}%`;
  el.progressHandle.style.left = `${pct}%`;
  el.currentTime.textContent = formatTime(current);
  el.durationTime.textContent = formatTime(duration);
  el.progressTrack.setAttribute("aria-valuenow", Math.round(pct));
}

function initProgressBarInteraction() {
  let dragging = false;
  let activePointerId = null;

  function fractionFromEvent(e) {
    const rect = el.progressTrack.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }

  function onPointerDown(e) {
    if (!state.duration) return;
    dragging = true;
    state.isSeeking = true;
    const fraction = fractionFromEvent(e);
    paintProgress(fraction * state.duration, state.duration);
    if (el.progressTrack.setPointerCapture && e.pointerId != null) {
      activePointerId = e.pointerId;
      el.progressTrack.setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const fraction = fractionFromEvent(e);
    paintProgress(fraction * state.duration, state.duration);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    const fraction = fractionFromEvent(e);
    seekTo(fraction, true);
    state.isSeeking = false;

    if (el.progressTrack.releasePointerCapture && activePointerId != null) {
      try {
        el.progressTrack.releasePointerCapture(activePointerId);
      } catch (err) {
        /* already released — safe to ignore */
      }
      activePointerId = null;
    }
  }

  el.progressTrack.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  el.progressTrack.addEventListener("keydown", (e) => {
    if (!state.duration) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      seekTo(Math.min(state.duration, (state.player.getCurrentTime() || 0) + 5));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekTo(Math.max(0, (state.player.getCurrentTime() || 0) - 5));
    }
  });
}

/* ==========================================================================
   13b. SWIPE / DRAG ON ALBUM ART — prev/next
   ========================================================================== */

function initArtSwipe() {
  let startX = 0;
  let currentX = 0;
  let dragging = false;
  const threshold = 45; // px before a drag counts as a swipe

  function onDown(e) {
    dragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    currentX = 0;
  }

  function onMove(e) {
    if (!dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
    currentX = x;
    el.artSwipeArea.style.transform = `translateX(${Math.max(-40, Math.min(40, x * 0.35))}px)`;
    el.swipeHintLeft.style.opacity = x > 10 ? "0.85" : "0";
    el.swipeHintRight.style.opacity = x < -10 ? "0.85" : "0";
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    el.artSwipeArea.style.transition = "transform 220ms ease";
    el.artSwipeArea.style.transform = "";
    el.swipeHintLeft.style.opacity = "0";
    el.swipeHintRight.style.opacity = "0";
    setTimeout(() => {
      el.artSwipeArea.style.transition = "";
    }, 240);

    if (currentX > threshold) {
      playPrevious();
    } else if (currentX < -threshold) {
      playNext();
    }
    currentX = 0;
  }

  el.artSwipeArea.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/* ==========================================================================
   14b. QUEUE DRAWER — swipeable "up next" panel
   ========================================================================== */

function initQueue() {
  el.queueBtn.addEventListener("click", toggleQueue);
  el.queueCloseBtn.addEventListener("click", closeQueue);
  el.queueBackdrop.addEventListener("click", closeQueue);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.queueOpen) closeQueue();
  });

  initQueueSwipeToClose();
  initQueueSearch();
}

// Filters the already-rendered queue rows by song title, artist/channel, and
// (when present in the title text itself, e.g. `From "Movie Name"`) the
// movie/album name. YouTube/oEmbed don't expose a separate movie or year
// field, so a year only matches if it's literally printed in the title.
function initQueueSearch() {
  el.queueSearchInput.addEventListener("input", () => {
    const query = el.queueSearchInput.value.trim().toLowerCase();
    el.queueSearchClear.style.display = query ? "flex" : "none";
    filterQueueRows(query);
  });

  el.queueSearchClear.addEventListener("click", () => {
    el.queueSearchInput.value = "";
    el.queueSearchClear.style.display = "none";
    filterQueueRows("");
    el.queueSearchInput.focus();
  });
}

function filterQueueRows(query) {
  const items = el.queueList.querySelectorAll(".queue-list-item");
  let visibleCount = 0;

  items.forEach((item) => {
    const row = item.querySelector(".queue-row");
    const videoId = row.dataset.videoId;
    const meta = state.queueMeta[videoId];
    const haystack = meta ? `${meta.title} ${meta.author}`.toLowerCase() : "";

    const matches = !query || haystack.includes(query);
    item.classList.toggle("is-filtered-out", !matches);
    if (matches) visibleCount += 1;
  });

  el.queueSearchEmpty.style.display = visibleCount === 0 ? "block" : "none";
}

function toggleQueue() {
  if (state.queueOpen) closeQueue();
  else openQueue();
}

function openQueue() {
  state.queueOpen = true;
  el.queuePanel.classList.add("is-open");
  el.queueBackdrop.classList.add("is-open");
  el.queuePanel.setAttribute("aria-hidden", "false");
  el.queueBtn.classList.add("is-active");
  el.queueBtn.setAttribute("aria-expanded", "true");
  highlightCurrentQueueRow(true);
}

function closeQueue() {
  state.queueOpen = false;
  el.queuePanel.classList.remove("is-open");
  el.queuePanel.style.transform = "";
  el.queueBackdrop.classList.remove("is-open");

  // aria-hidden can't be applied to an element that still contains focus
  // (the browser blocks it and logs a console violation) — this happens
  // whenever the queue is closed by clicking a queue-row itself, e.g. from
  // playQueueIndex(). Move focus back to the toggle button first so the
  // panel can be safely hidden from assistive tech.
  if (el.queuePanel.contains(document.activeElement)) {
    el.queueBtn.focus();
  }

  el.queuePanel.setAttribute("aria-hidden", "true");
  el.queueBtn.classList.remove("is-active");
  el.queueBtn.setAttribute("aria-expanded", "false");

  if (el.queueSearchInput && el.queueSearchInput.value) {
    el.queueSearchInput.value = "";
    el.queueSearchClear.style.display = "none";
    filterQueueRows("");
  }
}

function initQueueSwipeToClose() {
  let startY = 0;
  let currentY = 0;
  let dragging = false;

  function onDown(e) {
    dragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    el.queuePanel.style.transition = "none";
  }

  function onMove(e) {
    if (!dragging) return;
    currentY = (e.touches ? e.touches[0].clientY : e.clientY) - startY;
    if (currentY < 0) currentY = 0;
    el.queuePanel.style.transform = `translate(-50%, ${currentY}px)`;
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    el.queuePanel.style.transition = "";
    if (currentY > 90) {
      closeQueue();
    } else {
      el.queuePanel.style.transform = "";
    }
    currentY = 0;
  }

  [el.queueHandle, el.queueList.parentElement.querySelector(".queue-header")].forEach((handle) => {
    if (!handle) return;
    handle.addEventListener("pointerdown", onDown);
  });
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function runWithConcurrency(items, limit, worker) {
  let index = 0;
  let active = 0;

  return new Promise((resolve) => {
    function next() {
      if (index >= items.length && active === 0) {
        resolve();
        return;
      }
      while (active < limit && index < items.length) {
        const item = items[index++];
        active += 1;
        worker(item).finally(() => {
          active -= 1;
          next();
        });
      }
    }
    next();
  });
}

function fetchOEmbedMeta(videoId) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    "https://www.youtube.com/watch?v=" + videoId
  )}&format=json`;

  return fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      state.queueMeta[videoId] = {
        title: (data && data.title) || "Unavailable video",
        author: (data && data.author_name) || "",
      };
    })
    .catch(() => {
      state.queueMeta[videoId] = { title: "Unavailable video", author: "" };
    })
    .then(() => {
      refreshQueueRow(videoId);
    });
}

function buildQueueList(playlistIds) {
  state.queueIds = playlistIds.slice();
  el.queueList.innerHTML = "";

  playlistIds.forEach((videoId, index) => {
    const li = document.createElement("li");
    li.className = "queue-list-item";

    const row = document.createElement("button");
    row.type = "button";
    row.className = "queue-row";
    row.dataset.videoId = videoId;
    row.dataset.index = String(index);
    row.setAttribute("aria-label", `Play track ${index + 1}`);
    row.addEventListener("click", () => playQueueIndex(index));

    const indexLabel = document.createElement("span");
    indexLabel.className = "queue-row-index";

    const numSpan = document.createElement("span");
    numSpan.className = "eq-num";
    numSpan.textContent = String(index + 1);

    const eqBars = document.createElement("span");
    eqBars.className = "eq-bars";
    eqBars.setAttribute("aria-hidden", "true");
    eqBars.appendChild(document.createElement("span"));
    eqBars.appendChild(document.createElement("span"));
    eqBars.appendChild(document.createElement("span"));

    indexLabel.appendChild(numSpan);
    indexLabel.appendChild(eqBars);

    const thumb = document.createElement("img");
    thumb.className = "queue-row-thumb";
    thumb.alt = "";
    thumb.loading = "lazy";

    const text = document.createElement("span");
    text.className = "queue-row-text";
    const titleEl = document.createElement("span");
    titleEl.className = "queue-row-title";
    titleEl.textContent = "Loading…";
    const artistEl = document.createElement("span");
    artistEl.className = "queue-row-artist";
    text.appendChild(titleEl);
    text.appendChild(document.createElement("br"));
    text.appendChild(artistEl);

    row.appendChild(indexLabel);
    row.appendChild(thumb);
    row.appendChild(text);
    li.appendChild(row);
    el.queueList.appendChild(li);

    loadBestThumbnail(videoId, (url) => {
      thumb.src = url;
    });
  });

  const unknownIds = playlistIds.filter((id) => !state.queueMeta[id]);
  runWithConcurrency(unknownIds, 4, fetchOEmbedMeta);

  highlightCurrentQueueRow();
}

function refreshQueueRow(videoId) {
  const meta = state.queueMeta[videoId];
  if (!meta) return;
  const row = el.queueList.querySelector(`.queue-row[data-video-id="${cssEscape(videoId)}"]`);
  if (!row) return;
  const titleEl = row.querySelector(".queue-row-title");
  const artistEl = row.querySelector(".queue-row-artist");
  if (titleEl) titleEl.textContent = meta.title;
  if (artistEl) artistEl.textContent = meta.author;

  // Metadata for this row may have just arrived after the user already
  // typed a search — re-check it against the active query if there is one.
  if (el.queueSearchInput && el.queueSearchInput.value.trim()) {
    filterQueueRows(el.queueSearchInput.value.trim().toLowerCase());
  }
}

function highlightCurrentQueueRow(scrollIntoView) {
  if (!state.player || !state.player.getPlaylistIndex) return;
  const currentIndex = state.player.getPlaylistIndex();
  const rows = el.queueList.querySelectorAll(".queue-row");
  rows.forEach((row) => {
    const isCurrent = Number(row.dataset.index) === currentIndex;
    row.classList.toggle("is-current", isCurrent);
    row.classList.toggle("is-paused", isCurrent && !state.isPlaying);
    if (isCurrent && scrollIntoView) {
      row.scrollIntoView({ block: "nearest" });
    }
  });
}

function playQueueIndex(index) {
  if (!state.player || !state.player.playVideoAt) return;
  state.player.playVideoAt(index);
  closeQueue();
}

function cssEscape(value) {
  return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
}

/* ==========================================================================
   15. KEYBOARD SHORTCUTS
   ========================================================================== */

function initKeyboardControls() {
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : "";
    const isTyping =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      (document.activeElement && document.activeElement.isContentEditable);
    if (isTyping) return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        togglePlayPause();
        break;
      case "ArrowRight":
        e.preventDefault();
        if (state.player) seekTo(Math.min(state.duration, (state.player.getCurrentTime() || 0) + 5));
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (state.player) seekTo(Math.max(0, (state.player.getCurrentTime() || 0) - 5));
        break;
      case "n":
      case "N":
        playNext();
        break;
      case "p":
      case "P":
        playPrevious();
        break;
      default:
        break;
    }
  });
}

/* ==========================================================================
   16. UI SYNC HELPERS
   ========================================================================== */

function updateUI() {
  el.player.classList.toggle("is-playing", state.isPlaying);
  el.iconPlay.style.display = state.isPlaying ? "none" : "block";
  el.iconPause.style.display = state.isPlaying ? "block" : "none";
  el.playBtn.setAttribute("aria-label", state.isPlaying ? "Pause" : "Play");
  el.playBtn.title = state.isPlaying ? "Pause" : "Play";
}

/* ==========================================================================
   17. STATUS / LOADING / ERROR BANNER
   ========================================================================== */

let statusHideTimer = null;

function showStatus(message, opts) {
  opts = opts || {};
  clearTimeout(statusHideTimer);
  el.statusBanner.innerHTML = "";

  if (opts.loading) {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    el.statusBanner.appendChild(spinner);
  }

  const text = document.createElement("span");
  text.textContent = message;
  el.statusBanner.appendChild(text);

  el.statusBanner.classList.toggle("is-error", !!opts.error);
  el.statusBanner.classList.add("is-visible");

  if (opts.autoHide) {
    statusHideTimer = setTimeout(hideStatus, 3200);
  }
}

function hideStatus() {
  el.statusBanner.classList.remove("is-visible");
}

/* ==========================================================================
   17b. TOAST — brief, low-priority confirmations
   ========================================================================== */

let toastHideTimer = null;

function showToast(message, durationMs) {
  if (!el.toast) return;
  clearTimeout(toastHideTimer);
  el.toast.textContent = message;
  el.toast.classList.add("is-visible");
  toastHideTimer = setTimeout(() => {
    el.toast.classList.remove("is-visible");
  }, durationMs || 2200);
}

/* ==========================================================================
   18. UTILITIES
   ========================================================================== */

function formatTime(totalSeconds) {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}