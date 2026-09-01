/* ---- 省份名称离线兜底 ---- */
const PROVINCE_NAMES = [
  '自动定位', '北京', '天津', '上海', '重庆',
  '广东', '浙江', '江苏', '福建', '山东', '四川',
  '湖北', '湖南', '河南', '河北', '陕西', '辽宁',
  '云南', '贵州', '广西', '安徽', '江西',
  '黑龙江', '吉林', '山西', '甘肃', '海南',
  '内蒙古', '新疆', '西藏', '宁夏', '青海', '港澳台'
];

/* 城市数据，启动时从 cities.json 加载；加载失败时仅使用省份列表 */
let WEATHER_PROVINCES = [];

async function loadCityData() {
  try {
    const resp = await fetch('data/cities.json');
    if (resp.ok) {
      WEATHER_PROVINCES = await resp.json();
      return;
    }
  } catch {}
  /* fallback: 省份名称 + 空城市列表，仅 "自动定位" 保留一条空 query */
  WEATHER_PROVINCES = PROVINCE_NAMES.map(name => ({
    name,
    cities: name === '自动定位' ? [{ name: '自动定位', query: '' }] : []
  }));
}

const WEATHER_CODE_MAP = {
  113: { icon: '☀️', text: '晴' },
  116: { icon: '⛅', text: '多云' },
  119: { icon: '☁️', text: '阴天' },
  122: { icon: '☁️', text: '阴' },
  143: { icon: '🌫️', text: '雾' },
  176: { icon: '🌦️', text: '小雨' },
  179: { icon: '🌧️', text: '雨' },
  182: { icon: '🌧️', text: '雨' },
  185: { icon: '🌧️', text: '雨' },
  200: { icon: '⛈️', text: '雷暴' },
  227: { icon: '🌨️', text: '雪' },
  230: { icon: '🌨️', text: '暴雪' },
  248: { icon: '🌫️', text: '雾' },
  260: { icon: '🌫️', text: '雾' },
  263: { icon: '🌦️', text: '小雨' },
  266: { icon: '🌦️', text: '雨' },
  281: { icon: '🌧️', text: '雨' },
  284: { icon: '🌧️', text: '雨' },
  293: { icon: '🌦️', text: '小雨' },
  296: { icon: '🌦️', text: '小雨' },
  299: { icon: '🌧️', text: '中雨' },
  302: { icon: '🌧️', text: '中雨' },
  305: { icon: '🌧️', text: '大雨' },
  308: { icon: '🌧️', text: '大雨' },
  311: { icon: '🌧️', text: '雨' },
  314: { icon: '🌧️', text: '雨' },
  317: { icon: '🌧️', text: '雨' },
  320: { icon: '🌨️', text: '雨夹雪' },
  323: { icon: '🌨️', text: '雪' },
  326: { icon: '🌨️', text: '小雪' },
  329: { icon: '🌨️', text: '中雪' },
  332: { icon: '🌨️', text: '大雪' },
  335: { icon: '🌨️', text: '大雪' },
  338: { icon: '🌨️', text: '暴雪' },
  350: { icon: '🧊', text: '冰雹' },
  353: { icon: '🌦️', text: '小雨' },
  356: { icon: '🌧️', text: '中雨' },
  359: { icon: '🌧️', text: '大雨' },
  362: { icon: '🌧️', text: '雨' },
  365: { icon: '🌧️', text: '雨' },
  368: { icon: '🌨️', text: '小雪' },
  371: { icon: '🌨️', text: '大雪' },
  374: { icon: '🧊', text: '冰雹' },
  377: { icon: '🧊', text: '冰雹' },
  386: { icon: '⛈️', text: '雷暴' },
  389: { icon: '⛈️', text: '雷暴' },
  392: { icon: '⛈️', text: '雷阵雪' },
  395: { icon: '⛈️', text: '雷暴' }
};

const CACHE_DURATION = 30 * 60 * 1000;
const CACHE_VERSION = 7;

function findCityByQuery(query) {
  for (const prov of WEATHER_PROVINCES) {
    const city = prov.cities.find(c => c.query === query);
    if (city) return { province: prov.name, city: city };
  }
  return null;
}

function parseWttrTime(t) {
  const n = parseInt(t, 10);
  return Math.floor(n / 100);
}

function mapCode(code) {
  return WEATHER_CODE_MAP[code] || { icon: '🌤️', text: '' };
}

function buildHourly24(weatherDays) {
  if (!Array.isArray(weatherDays) || weatherDays.length === 0) return null;
  const points = [];
  const now = new Date();
  const startHour = now.getHours();

  for (let d = 0; d < weatherDays.length && points.length < 12; d++) {
    const day = weatherDays[d];
    if (!day || !Array.isArray(day.hourly)) continue;
    for (const h of day.hourly) {
      const hour = parseWttrTime(h.time);
      if (d === 0 && hour < startHour) continue;
      points.push({
        hour,
        dayOffset: d,
        tempC: parseFloat(h.tempC),
        chanceofrain: parseFloat(h.chanceofrain || '0'),
        code: parseInt(h.weatherCode, 10)
      });
      if (points.length >= 12) break;
    }
  }

  if (points.length < 2) return null;

  const result = [];
  for (let i = 0; i < 24; i++) {
    const targetHour = (startHour + i) % 24;
    const targetDayOffset = Math.floor((startHour + i) / 24);
    const targetKey = targetDayOffset * 24 + targetHour;

    let prev = points[0];
    let next = points[points.length - 1];
    for (let j = 0; j < points.length; j++) {
      const pKey = points[j].dayOffset * 24 + points[j].hour;
      if (pKey <= targetKey) prev = points[j];
      if (pKey >= targetKey) { next = points[j]; break; }
    }
    const prevKey = prev.dayOffset * 24 + prev.hour;
    const nextKey = next.dayOffset * 24 + next.hour;
    const span = nextKey - prevKey;
    const ratio = span === 0 ? 0 : (targetKey - prevKey) / span;

    const temp = prev.tempC + (next.tempC - prev.tempC) * ratio;
    const rain = prev.chanceofrain + (next.chanceofrain - prev.chanceofrain) * ratio;
    const code = ratio < 0.5 ? prev.code : next.code;
    const mapped = mapCode(code);

    result.push({
      hour: targetHour,
      temp: Math.round(temp),
      rain: Math.round(rain),
      icon: mapped.icon
    });
  }
  return result;
}

const Weather = {
  cache: null,
  coords: null,
  selectedCityQuery: '',
  _timerId: null,
  _inited: false,
  _failed: false,

  async init() {
    // 守卫：即使注册表路径外出现重复调用，也只在首次执行（防止重复 fetch/建定时器）
    if (this._inited) return;
    this._inited = true;
    await loadCityData();
    const settings = await Storage.getSettings();
    this.selectedCityQuery = settings.weatherCity || '';
    if (settings.weatherCache) {
      this.cache = settings.weatherCache;
      this.render();
    }
    // 异步启动位置检测 + 天气刷新，不阻塞页面渲染
    this._initAsync().catch(() => {});
    this.startRefresh();
  },

  startRefresh() {
    // 已有定时器不重复创建
    if (this._timerId) return;
    this._timerId = setInterval(() => this.refresh(), CACHE_DURATION);
  },

  stopRefresh() {
    // 组件隐藏时停止刷新，避免后台持续请求 wttr.in（隐私友好）
    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  },

  async _initAsync() {
    if (!this.selectedCityQuery) {
      await this.detectLocation();
    }
    await this.refresh();
  },

  async setCity(query) {
    this.selectedCityQuery = query;
    this.cache = null;
    this._failed = false;
    await Storage.updateSettings({ weatherCity: query, weatherCache: null });
    await this.refresh();
  },

  detectLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.coords = {
            lat: pos.coords.latitude.toFixed(2),
            lng: pos.coords.longitude.toFixed(2)
          };
          resolve();
        },
        () => {
          resolve();
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  },

  async fetchWeather(retries = 2, onFirstFail) {
    let url;
    if (this.selectedCityQuery) {
      url = `https://wttr.in/${this.selectedCityQuery}?format=j1&lang=zh`;
    } else if (this.coords) {
      url = `https://wttr.in/${this.coords.lat},${this.coords.lng}?format=j1&lang=zh`;
    } else {
      url = 'https://wttr.in/?format=j1&lang=zh';
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        // PBI-18：首次超时 5 秒，尽快让用户看到降级文案（US-21 AC1）
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('Weather fetch failed');
        const data = await response.json();
        const current = data.current_condition[0];
        const code = parseInt(current.weatherCode, 10);
        const mapped = WEATHER_CODE_MAP[code] || { icon: '🌤️', text: current.weatherDesc[0].value };

        const hourly = buildHourly24(data.weather);
        const today = Array.isArray(data.weather) && data.weather[0] ? data.weather[0] : null;
        const todayHigh = today ? parseInt(today.maxtempC, 10) : null;
        const todayLow = today ? parseInt(today.mintempC, 10) : null;

        return {
          temp: current.temp_C,
          icon: mapped.icon,
          desc: mapped.text,
          hourly,
          todayHigh,
          todayLow,
          timestamp: Date.now(),
          version: CACHE_VERSION
        };
      } catch {
        if (attempt === 0 && typeof onFirstFail === 'function') {
          // 首次失败立即通知调用方渲染降级文案，重试在后台继续
          onFirstFail();
        }
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    return null;
  },

  getDisplayCity() {
    if (!this.selectedCityQuery) return '';
    const match = findCityByQuery(this.selectedCityQuery);
    if (!match) return '';
    const province = match.province;
    const cityName = match.city.name;
    if (province === '港澳台' || province === '北京' || province === '天津' || province === '上海' || province === '重庆') {
      return cityName;
    }
    return `${province} · ${cityName}`;
  },

  async refresh() {
    // PBI-18：首次失败即渲染降级文案（5s 内），重试成功自动恢复（US-21 AC1/AC3）
    const data = await this.fetchWeather(2, () => {
      this._failed = true;
      this.render();
    });
    if (data) {
      this.cache = data;
      this._failed = false;
      await Storage.updateSettings({ weatherCache: data });
    }
    this.render();
  },

  render() {
    const el = document.getElementById('weatherWidget');
    if (!el) return;
    if (!this.cache) {
      const offline = !navigator.onLine;
      if (offline) {
        el.innerHTML = '<span class="weather-loading">离线</span>';
        return;
      }
      if (this._failed) {
        // PBI-18：无缓存且请求失败 → 明确降级文案 + 重试入口
        el.innerHTML = '<span class="weather-loading">天气暂不可用</span><button class="weather-retry" type="button">重试</button>';
        const retry = el.querySelector('.weather-retry');
        if (retry) {
          retry.addEventListener('click', () => {
            this._failed = false;
            this.render();
            this.refresh();
          });
        }
        return;
      }
      el.innerHTML = '<span class="weather-loading">获取天气中...</span>';
      return;
    }
    const display = this.getDisplayCity();
    const loc = display ? `<span class="weather-sep">|</span><span class="weather-desc">${display}</span>` : '';
    el.innerHTML = `
      <span class="weather-icon">${this.cache.icon}</span>
      <span class="weather-temp">${this.cache.temp}°C</span>
      <span class="weather-sep">|</span>
      <span class="weather-desc">${escapeHtml(this.cache.desc)}</span>
      ${loc}
      ${this.renderHoverCard()}
    `;
    this.bindHoverEvents(el);
  },

  bindHoverEvents(el) {
    let hideTimer = null;
    const card = el.querySelector('.weather-hover-card');
    if (!card) return;
    const showCard = () => {
      clearTimeout(hideTimer);
      el.classList.add('show-weather-card');
    };
    const hideCard = () => {
      hideTimer = setTimeout(() => el.classList.remove('show-weather-card'), 200);
    };
    el.addEventListener('mouseenter', showCard);
    el.addEventListener('mouseleave', hideCard);
    card.addEventListener('mouseenter', showCard);
    card.addEventListener('mouseleave', hideCard);
  },

  renderHoverCard() {
    const hourly = this.cache && this.cache.hourly;
    if (!hourly || hourly.length === 0) return '';

    const display = this.getDisplayCity();
    const high = this.cache.todayHigh;
    const low = this.cache.todayLow;
    const range = (high != null && low != null) ? `今日 ${low}° ~ ${high}°` : '';
    // PBI-18：有缓存时标注数据时间
    let updated = '';
    if (this.cache.timestamp) {
      const d = new Date(this.cache.timestamp);
      updated = `更新于 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    const header = [display, range, updated].filter(Boolean).join(' &middot; ');

    const bars = hourly.map((h, idx) => {
      const showLabel = idx === 0 || idx % 3 === 0;
      const showIcon = idx === 0 || idx % 3 === 0;
      const heightPct = Math.max(6, h.rain);
      const opacity = 0.35 + (h.rain / 100) * 0.65;
      const hourLabel = idx === 0 ? '现在' : String(h.hour).padStart(2, '0');
      const nowClass = idx === 0 ? ' whc-now' : '';
      return `
        <div class="whc-col${nowClass}">
          <div class="whc-icon">${showIcon ? h.icon : ''}</div>
          <div class="whc-temp">${showIcon ? h.temp + '°' : ''}</div>
          <div class="whc-bar-wrap">
            <div class="whc-bar" style="height:${heightPct}%; opacity:${opacity.toFixed(2)}"></div>
          </div>
          <div class="whc-hour">${showLabel ? hourLabel : ''}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="weather-hover-card" role="tooltip">
        <div class="whc-header">${header}</div>
        <div class="whc-grid">${bars}</div>
      </div>
    `;
  }
};
