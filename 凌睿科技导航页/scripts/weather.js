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

/* ---- 备用数据源 Open-Meteo ----
 * 2026-09-15 wttr.in 的 Let's Encrypt 证书过期（valid_to = Sep 15 08:35 GMT），
 * 浏览器侧直接 CERT_HAS_EXPIRED，天气在全新安装的电脑上必然失败。
 * 备用源只在主源失败后启用，且必须用经纬度查询（城市坐标随 cities.json 分发）。 */
const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_QUERY = 'current=temperature_2m,weather_code'
  + '&hourly=temperature_2m,precipitation_probability,weather_code'
  + '&daily=temperature_2m_max,temperature_2m_min'
  + '&timezone=auto&forecast_days=2';

/* WMO 天气代码（Open-Meteo 口径，与 wttr.in 的 WWO 代码不是一套，不能复用） */
const WMO_CODE_MAP = {
  0: { icon: '☀️', text: '晴' },
  1: { icon: '🌤️', text: '晴间多云' },
  2: { icon: '⛅', text: '多云' },
  3: { icon: '☁️', text: '阴' },
  45: { icon: '🌫️', text: '雾' },
  48: { icon: '🌫️', text: '雾凇' },
  51: { icon: '🌦️', text: '小毛毛雨' },
  53: { icon: '🌦️', text: '毛毛雨' },
  55: { icon: '🌧️', text: '大毛毛雨' },
  56: { icon: '🌧️', text: '冻毛毛雨' },
  57: { icon: '🌧️', text: '冻毛毛雨' },
  61: { icon: '🌦️', text: '小雨' },
  63: { icon: '🌧️', text: '中雨' },
  65: { icon: '🌧️', text: '大雨' },
  66: { icon: '🌧️', text: '冻雨' },
  67: { icon: '🌧️', text: '冻雨' },
  71: { icon: '🌨️', text: '小雪' },
  73: { icon: '🌨️', text: '中雪' },
  75: { icon: '🌨️', text: '大雪' },
  77: { icon: '🌨️', text: '雪粒' },
  80: { icon: '🌦️', text: '阵雨' },
  81: { icon: '🌧️', text: '中阵雨' },
  82: { icon: '🌧️', text: '强阵雨' },
  85: { icon: '🌨️', text: '阵雪' },
  86: { icon: '🌨️', text: '强阵雪' },
  95: { icon: '⛈️', text: '雷暴' },
  96: { icon: '⛈️', text: '雷暴伴冰雹' },
  99: { icon: '⛈️', text: '雷暴伴大冰雹' }
};

function mapWmoCode(code) {
  return WMO_CODE_MAP[code] || { icon: '🌤️', text: '—' };
}

/* Open-Meteo 的 hourly 是扁平数组（time/temperature_2m/... 各自一列），
   与 wttr.in 的 weather[].hourly[] 结构完全不同，需要单独构建。
   timezone=auto 让 time 与 current.time 都是查询地当地时间，直接切片取小时即可，
   不需要 wttr 那条"按城市当地时间对齐"的插值逻辑（P3-4）。 */
function buildHourlyFromOpenMeteo(hourly, currentTimeIso) {
  if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) return null;
  const temps = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
  const rains = Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [];
  const codes = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];

  const startKey = String(currentTimeIso || '').slice(0, 13); // "YYYY-MM-DDTHH"
  let start = startKey ? hourly.time.findIndex(t => String(t).slice(0, 13) === startKey) : -1;
  if (start < 0) start = 0;

  const points = [];
  for (let i = start; i < hourly.time.length && points.length < 24; i++) {
    const temp = Number(temps[i]);
    if (!Number.isFinite(temp)) continue;
    const t = String(hourly.time[i]);
    points.push({
      hour: parseInt(t.slice(11, 13), 10),
      temp: Math.round(temp),
      rain: Math.round(Number(rains[i]) || 0),
      icon: mapWmoCode(codes[i]).icon
    });
  }
  return points.length >= 2 ? points : null;
}

/* 把 Open-Meteo 响应规范化成与 wttr.in 相同的缓存结构，UI 与渲染逻辑无需区分数据来源 */
function buildOpenMeteoCache(data) {
  const current = data && data.current;
  if (!current || !Number.isFinite(Number(current.temperature_2m))) return null;
  const mapped = mapWmoCode(current.weather_code);
  const daily = (data && data.daily) || {};
  const highs = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
  const lows = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
  return {
    temp: String(Math.round(Number(current.temperature_2m))),
    icon: mapped.icon,
    desc: mapped.text,
    hourly: buildHourlyFromOpenMeteo(data.hourly, current.time),
    todayHigh: highs.length && Number.isFinite(Number(highs[0])) ? Math.round(Number(highs[0])) : null,
    todayLow: lows.length && Number.isFinite(Number(lows[0])) ? Math.round(Number(lows[0])) : null,
    timestamp: Date.now(),
    version: CACHE_VERSION,
    source: 'open-meteo'
  };
}

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

/* 从 wttr.in 的 localObsDateTime（形如 "2026-09-13 11:00 PM"）解析出城市当地小时（P3-4）。
   解析不出来时返回 null，调用方回退到浏览器本地时间。 */
function parseLocalHour(s) {
  const m = String(s || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h;
}

function buildHourly24(weatherDays, localHour) {
  if (!Array.isArray(weatherDays) || weatherDays.length === 0) return null;
  const points = [];
  // P3-4：起点小时必须取查询城市的当地时间。此前用浏览器本地时间，在境外查国内城市时
  // 会切错点，"现在"标签与整条 24 小时曲线都会偏移
  const startHour = Number.isInteger(localHour) ? localHour : new Date().getHours();

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
  _active: true, // 组件期望运行状态，由 startRefresh / stopRefresh 维护（P2-10）

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
    // 初始化期间组件可能已被隐藏（onHide → stopRefresh 已把 _active 置 false）。
    // 此处若照常启动，定时器会一直跑下去，且因为 _visible 已经是 false，
    // 后续不会再触发 onHide，没有任何路径能停掉它（P2-10）
    if (this._active) this.startRefresh();
  },

  startRefresh() {
    this._active = true;
    // 已有定时器不重复创建
    if (this._timerId) return;
    this._timerId = setInterval(() => this.refresh(), CACHE_DURATION);
  },

  stopRefresh() {
    // 组件隐藏时停止刷新，避免后台持续请求 wttr.in（隐私友好）
    this._active = false;
    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  },

  async _initAsync() {
    // 组件可能在初始化期间被隐藏（onHide → stopRefresh 已把 _active 置 false）。
    // 此时不应再发起定位与天气请求，否则违背"组件隐藏即停止请求"的隐私承诺（P2-10 残余）
    if (!this._active) return;
    if (!this.selectedCityQuery) {
      await this.detectLocation();
    }
    if (!this._active) return; // 定位期间被隐藏
    await this.refresh();
  },

  /* 浏览器定位：扩展页里基本拿不到——chrome-extension:// 页面既不弹授权气泡，
     permissions.query 长期停在 prompt，最终 code=3 Timeout（2026-09-15 实测，
     加 geolocation 权限也一样）。保留它是为了用户在本机已授权时仍能用更准的坐标。 */
  _geoLocate() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      let settled = false;
      let timer = null;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      // 不能只依赖 getCurrentPosition 的 timeout 选项：扩展页里授权提示挂起时
      // 成功与失败回调都不会触发，该选项不生效，detectLocation 会永久悬停，
      // 连带 IP 定位拿到的坐标也永远赋不上值（E2E [27] 正是卡在这里暴露的）
      timer = setTimeout(() => finish(null), 4500);
      navigator.geolocation.getCurrentPosition(
        (pos) => finish({
          lat: pos.coords.latitude.toFixed(2),
          lng: pos.coords.longitude.toFixed(2),
          source: 'geo'
        }),
        () => finish(null),
        { timeout: 4000, enableHighAccuracy: false }
      );
    });
  },

  /* IP 定位兜底：只回一个城市级大致坐标，不发送任何本地数据，也不需要授权。
     没有它，全新安装的电脑既没有城市也没有坐标，备用源会因为拿不到经纬度而用不上。 */
  async _ipLocate() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch('https://ipwho.is/', { signal: controller.signal });
      if (!resp.ok) throw new Error('IP locate failed');
      const d = await resp.json();
      if (!d || d.success === false) return null;
      const lat = Number(d.latitude);
      const lon = Number(d.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return { lat: lat.toFixed(2), lng: lon.toFixed(2), source: 'ip' };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async detectLocation() {
    if (!this._active) return;
    // 两者并行：浏览器定位大概率要等到超时才失败，串行会让首次出天气白等两轮
    const geoPromise = this._geoLocate();
    const ipPromise = this._ipLocate();
    const geo = await geoPromise;
    const ip = await ipPromise;
    this.coords = geo || ip || null;
  },

  /* 备用源（Open-Meteo）只认经纬度：优先用户明确选中的城市，其次定位结果。
     两者都没有时返回 null，此时备用源不可用，直接走降级文案。 */
  resolveCoords() {
    if (this.selectedCityQuery) {
      const match = findCityByQuery(this.selectedCityQuery);
      const city = match && match.city;
      if (city && Number.isFinite(city.lat) && Number.isFinite(city.lon)) {
        return { lat: city.lat, lon: city.lon };
      }
      return null;
    }
    if (this.coords) {
      const lat = Number(this.coords.lat);
      const lon = Number(this.coords.lng);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    return null;
  },

  async setCity(query) {
    this.selectedCityQuery = query;
    this.cache = null;
    this._failed = false;
    await Storage.updateSettings({ weatherCity: query, weatherCache: null });
    // 从具体城市切回"自动定位"时需要重新取一次坐标，否则备用源无坐标可用
    if (!query && !this.coords) await this.detectLocation();
    await this.refresh();
  },

  /* 主源 wttr.in。retries 默认为 0：失败后立即让位给备用源，
     跨源切换本身比在同一源上退避重试更有效（且总等待从 18s 降到 10s 以内）。 */
  async fetchWeather(retries = 0, onFirstFail) {
    let url;
    if (this.selectedCityQuery) {
      url = `https://wttr.in/${this.selectedCityQuery}?format=j1&lang=zh`;
    } else if (this.coords) {
      url = `https://wttr.in/${this.coords.lat},${this.coords.lng}?format=j1&lang=zh`;
    } else {
      url = 'https://wttr.in/?format=j1&lang=zh';
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      // PBI-18：首次超时 5 秒，尽快让用户看到降级文案（US-21 AC1）
      // 超时须覆盖整轮请求（含 response.json() 的响应体读取），并在 finally 中清理，
      // 否则响应头返回后 body 挂起时既不会超时、fetch 抛错时又会遗留定时器
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('Weather fetch failed');
        const data = await response.json();
        const current = data.current_condition[0];
        const code = parseInt(current.weatherCode, 10);
        const mapped = WEATHER_CODE_MAP[code] || { icon: '🌤️', text: current.weatherDesc[0].value };

        const hourly = buildHourly24(data.weather, parseLocalHour(current.localObsDateTime));
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
          version: CACHE_VERSION,
          source: 'wttr.in'
        };
      } catch {
        if (attempt === 0 && typeof onFirstFail === 'function') {
          // 首次失败立即通知调用方渲染降级文案，后续尝试在后台继续
          onFirstFail();
        }
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }
    return null;
  },

  /* 备用源 Open-Meteo：只在主源失败后调用，超时口径与主源一致（5s） */
  async fetchOpenMeteoWeather() {
    const coords = this.resolveCoords();
    if (!coords) return null;
    const url = `${OPEN_METEO_API}?latitude=${coords.lat}&longitude=${coords.lon}&${OPEN_METEO_QUERY}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Open-Meteo fetch failed');
      return buildOpenMeteoCache(await response.json());
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
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
    // PBI-18：首次失败即渲染降级文案（5s 内），后续源成功自动恢复（US-21 AC1/AC3）
    let data = await this.fetchWeather(0, () => {
      this._failed = true;
      this.render();
    });
    // 主源不可用 → 回退备用源。两者是独立服务、独立证书、独立网络路径，
    // 2026-09-15 的 wttr.in 证书过期就是靠这条链路兜住的
    if (!data) {
      data = await this.fetchOpenMeteoWeather();
    }
    if (data) {
      this.cache = data;
      this._failed = false;
      await Storage.updateSettings({ weatherCache: data });
    }
    this.render();
  },

  /* 降级引导：打开设置面板的天气页签 */
  openCitySettings() {
    if (typeof Settings === 'undefined') return;
    Settings.open();
    Settings.switchTab('weather');
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
        // PBI-18：无缓存且请求失败 → 明确降级文案 + 重试入口。
        // 若连坐标都没有（定位失败且未选城市），备用源同样无从查起，
        // 此时给一条能走通的路（去设置里选城市），而不是让用户反复点重试
        if (!this.selectedCityQuery && !this.coords) {
          el.innerHTML = '<span class="weather-loading">未获取到位置</span><button class="weather-retry weather-pick-city" type="button">选择城市</button>';
          const pick = el.querySelector('.weather-pick-city');
          if (pick) pick.addEventListener('click', () => this.openCitySettings());
          return;
        }
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
      <span class="weather-icon">${escapeHtml(String(this.cache.icon == null ? '' : this.cache.icon))}</span>
      <span class="weather-temp">${escapeHtml(String(this.cache.temp == null ? '' : this.cache.temp))}°C</span>
      <span class="weather-sep">|</span>
      <span class="weather-desc">${escapeHtml(this.cache.desc)}</span>
      ${loc}
      ${this.renderHoverCard()}
    `;
    this.bindHoverEvents(el);
  },

  bindHoverEvents(el) {
    const card = el.querySelector('.weather-hover-card');
    if (!card) return;
    // #weatherWidget 是静态元素，但 render() 会反复重建它的 innerHTML。
    // 绑定在 el 自身的监听器必须只绑一次：否则每次 render 净增 2 个，且闭包会一直持有
    // 已被移除的旧卡片节点使其无法回收（P2-11：实测 16 次 render 累积到 34 个监听器）
    if (!this._hoverBound) {
      this._hoverBound = true;
      this._hideTimer = null;
      this._showCard = () => {
        clearTimeout(this._hideTimer);
        el.classList.add('show-weather-card');
      };
      this._hideCard = () => {
        this._hideTimer = setTimeout(() => el.classList.remove('show-weather-card'), 200);
      };
      el.addEventListener('mouseenter', this._showCard);
      el.addEventListener('mouseleave', this._hideCard);
    }
    // 悬停卡片每次 render 都是新节点，需重新绑定；旧节点随 innerHTML 重建被回收
    card.addEventListener('mouseenter', this._showCard);
    card.addEventListener('mouseleave', this._hideCard);
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

/* Node 单测导出（浏览器里没有 module，不受影响；同 network-audit.js 的写法） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Weather,
    mapWmoCode,
    buildHourlyFromOpenMeteo,
    buildOpenMeteoCache,
    buildHourly24,
    loadCityData,
    findCityByQuery,
    getProvinces: () => WEATHER_PROVINCES
  };
}
