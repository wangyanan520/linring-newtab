/**
 * 天气备用源与容灾链测试（node:test）
 * 运行：npm test
 *
 * 背景：2026-09-15 wttr.in 的 TLS 证书过期，导致全新安装的电脑天气直接失败
 * （本机因有持久化缓存而看不出问题）。修复引入了 Open-Meteo 备用源、城市坐标
 * 与 IP 定位兜底，这里覆盖其中的纯函数与整条容灾链。
 *
 * 断言有效性要求（.agents/rules.md「验证有效性」）：每条断言都应能在回退被测
 * 代码后变红，因此容灾链测试走的是真实的 refresh() 分支，而不是复刻一份逻辑。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CITIES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'data', 'cities.json'), 'utf8'));

/* weather.js 是浏览器全局脚本：require 前先补上它运行期依赖的全局符号。
   注意每次调用都会清缓存重新加载，一个测试里只能调一次，
   否则 Weather 与 loadCityData 会来自两个互不相干的模块实例。 */
function loadWeather() {
  const modPath = require.resolve('../../src/scripts/weather.js');
  delete require.cache[modPath];
  global.Storage = global.Storage || {
    updateSettings: async () => {},
    getSettings: async () => ({})
  };
  global.escapeHtml = global.escapeHtml || (s => String(s == null ? '' : s));
  return require(modPath);
}

/* Open-Meteo 的固定响应：结构照抄真实返回（timezone=auto 下 time 为当地时间） */
const MOCK_OPEN_METEO = {
  current: { time: '2026-09-15T22:30', temperature_2m: 24.6, weather_code: 2 },
  hourly: {
    time: Array.from({ length: 48 }, (_, i) => {
      const day = i < 24 ? '2026-09-15' : '2026-09-16';
      return `${day}T${String(i % 24).padStart(2, '0')}:00`;
    }),
    temperature_2m: Array.from({ length: 48 }, (_, i) => 20 + (i % 10)),
    precipitation_probability: Array.from({ length: 48 }, (_, i) => (i * 7) % 100),
    weather_code: Array.from({ length: 48 }, () => 61)
  },
  daily: { temperature_2m_max: [31, 30.9], temperature_2m_min: [23.4, 24] }
};

function cityByQuery(query) {
  for (const prov of CITIES) {
    const city = prov.cities.find(c => c.query === query);
    if (city) return city;
  }
  throw new Error('测试数据缺少城市: ' + query);
}

test('天气：WMO 代码映射（Open-Meteo 口径，不得复用 wttr 的 WWO 表）', () => {
  const { mapWmoCode, Weather } = loadWeather();
  assert.strictEqual(mapWmoCode(0).text, '晴');
  assert.strictEqual(mapWmoCode(2).text, '多云');
  assert.strictEqual(mapWmoCode(61).text, '小雨');
  assert.strictEqual(mapWmoCode(95).text, '雷暴');
  // 未知代码给兜底而不是抛错/空白
  assert.strictEqual(mapWmoCode(1234).icon, '🌤️');
  // wttr 的 WWO 代码（116=多云）落到 WMO 表里不该产生错误文案
  assert.notStrictEqual(mapWmoCode(116).text, '多云');
  assert.ok(Weather && typeof Weather.refresh === 'function');
});

test('天气：wttr.in 的扩展代码（霾/沙尘族）已进码表', () => {
  const { WEATHER_CODE_MAP, resolveWwoWeather } = loadWeather();
  /* 这 5 个都**不在** WWO 那 47 个标准代码里，是 wttr.in 额外返回的扩展代码，
     且全部指向中国的霾与沙尘天气。缺任何一个，对应天气就会掉进"未知天气"。
     首轮修复只补了 137/149，46 城复测又冒出 125/134/140 —— 这条断言就是为了
     让"再漏一个"必须显式地红灯，而不是悄悄降级。 */
  const extended = [[125, '霾'], [134, '尘暴'], [137, '沙尘暴'], [140, '强沙尘暴'], [149, '烟霾']];
  for (const [code, want] of extended) {
    const got = WEATHER_CODE_MAP[code] && WEATHER_CODE_MAP[code].text;
    assert.strictEqual(got, want, `码表 code=${code} 应为「${want}」，实际「${got}」`);
  }
  // 命中码表时图标取自码表，不落进描述映射的通用图标（据此可区分两层修复）
  assert.strictEqual(resolveWwoWeather(149, [{ value: 'Smoky haze' }]).icon, '🌫️');
  assert.strictEqual(resolveWwoWeather(137, [{ value: 'Sandstorm' }]).icon, '🌪️');
  assert.strictEqual(resolveWwoWeather(140, [{ value: 'Severe sandstorm' }]).icon, '🌪️');
});

test('天气：46 城实测到的 weatherDesc 必须全部有中文文案', () => {
  const { resolveWwoWeather } = loadWeather();
  /* 2026-09-17 采样：46 个城市 ×（current + 3 天 hourly）的真实 wttr.in 响应，
     去重后 25 种 (weatherCode, weatherDesc) 组合。这是"描述文本"这一侧的完整
     已知集合，扩样本时若出现新描述，下面的断言会直接红灯。 */
  const OBSERVED = [
    [113, 'Sunny'], [113, 'Clear'], [116, 'Partly Cloudy'], [119, 'Cloudy'], [122, 'Overcast'],
    [125, 'Haze'], [134, 'Dust storm'], [137, 'Sandstorm'], [140, 'Severe sandstorm'],
    [143, 'Mist'], [149, 'Smoky haze'], [176, 'Patchy rain nearby'],
    [200, 'Thundery outbreaks in nearby'], [260, 'Freezing fog'], [266, 'Light drizzle'],
    [296, 'Light rain'], [299, 'Moderate rain at times'], [302, 'Moderate rain'],
    [311, 'Light freezing rain'], [314, 'Moderate or heavy freezing rain'],
    [353, 'Light rain shower'], [362, 'Light sleet showers'], [368, 'Light snow showers'],
    [371, 'Moderate or heavy snow showers'], [386, 'Patchy light rain in area with thunder'],
  ];
  const isBad = t => t === '未知天气' || /[A-Za-z]/.test(t);

  // 其一：纯粹考验描述映射 —— 用码表外的代码，否则会被码表兜住而测不到这一层
  const viaDesc = OBSERVED.filter(([, desc]) => isBad(resolveWwoWeather(9999, [{ value: desc }]).text))
    .map(([, desc]) => desc);
  assert.deepStrictEqual(viaDesc, [],
    '以下真实描述在 WWO_DESC_ZH 里查不到: ' + viaDesc.join(' | '));

  // 其二：端到端 —— 按真实代码查也不得落到"未知天气"或英文
  const viaCode = OBSERVED.filter(([code, desc]) => isBad(resolveWwoWeather(code, [{ value: desc }]).text))
    .map(([code, desc]) => `${code}:"${desc}"`);
  assert.deepStrictEqual(viaCode, [],
    '以下真实组合未能得到中文文案: ' + viaCode.join(' | '));
});

test('天气：wttr 未覆盖代码不得把英文描述渲染进中文界面', () => {
  const { resolveWwoWeather } = loadWeather();
  // 未知代码 + 可识别的英文描述 → 中文
  assert.strictEqual(resolveWwoWeather(9999, [{ value: 'Sandstorm' }]).text, '沙尘暴');
  // wttr.in 的部分描述带尾部空格（实测 "Overcast "），trim 后仍要能对上
  assert.strictEqual(resolveWwoWeather(9999, [{ value: 'Overcast ' }]).text, '阴');
  assert.strictEqual(resolveWwoWeather(9999, [{ value: 'LIGHT RAIN' }]).text, '小雨');
  // 完全识别不出时给中文兜底。旧实现是直接吐 weatherDesc 原文，
  // 这条断言在回退后会因文案含英文字母而变红
  const unknown = resolveWwoWeather(9999, [{ value: 'Weird Weather XYZ' }]);
  assert.ok(!/[A-Za-z]/.test(unknown.text), `兜底文案不得含英文字母，实际 "${unknown.text}"`);
  // 描述结构异常不得抛错：该函数被 try 块包着，抛错会让整轮主源请求被判失败，
  // 从而白白让位给备用源（真实响应里 weatherDesc 缺失并非不可能）
  assert.ok(resolveWwoWeather(9999, undefined).text);
  assert.ok(resolveWwoWeather(9999, []).text);
  assert.ok(resolveWwoWeather(9999, [{ value: null }]).text);
});

test('天气：Open-Meteo hourly 扁平数组 → UI 需要的 24 点结构', () => {
  const { buildHourlyFromOpenMeteo } = loadWeather();
  const points = buildHourlyFromOpenMeteo(MOCK_OPEN_METEO.hourly, '2026-09-15T22:30');
  assert.strictEqual(points.length, 24, '取满 24 个小时点');
  assert.strictEqual(points[0].hour, 22, '起点对齐 current.time 的小时');
  assert.strictEqual(points[0].temp, 20 + (22 % 10), '温度取对应下标');
  assert.strictEqual(points[0].rain, (22 * 7) % 100);
  assert.strictEqual(points[0].icon, '🌦️', 'weather_code=61 → 小雨图标');
  assert.strictEqual(points[23].hour, 21, '跨越午夜后小时回绕');
});

test('天气：Open-Meteo 数据不足时按 null 处理，避免渲染空卡片', () => {
  const { buildHourlyFromOpenMeteo } = loadWeather();
  assert.strictEqual(buildHourlyFromOpenMeteo(null, 'x'), null);
  assert.strictEqual(buildHourlyFromOpenMeteo({ time: [] }, 'x'), null);
  assert.strictEqual(buildHourlyFromOpenMeteo({ time: ['2026-09-15T22:00'], temperature_2m: [20] }, 'x'), null,
    '仅 1 个点不足以画趋势');
  // current.time 对不上时退回首个可用点，而不是整体失败
  const fallback = buildHourlyFromOpenMeteo(MOCK_OPEN_METEO.hourly, '1999-01-01T00:00');
  assert.strictEqual(fallback.length, 24);
  assert.strictEqual(fallback[0].hour, 0);
});

test('天气：Open-Meteo 响应规范化为与主源一致的缓存结构', () => {
  const { buildOpenMeteoCache } = loadWeather();
  const cache = buildOpenMeteoCache(MOCK_OPEN_METEO);
  assert.strictEqual(cache.temp, '25', '温度四舍五入为字符串，与 wttr 的 temp_C 同类型');
  assert.strictEqual(cache.desc, '多云');
  assert.strictEqual(cache.icon, '⛅');
  assert.strictEqual(cache.todayHigh, 31);
  assert.strictEqual(cache.todayLow, 23);
  assert.strictEqual(cache.hourly.length, 24);
  assert.strictEqual(cache.source, 'open-meteo', '标注来源便于区分与排查');
  assert.ok(cache.timestamp > 0);
  // 缺字段不得产出半截缓存（宁可降级，也不渲染错数据）
  assert.strictEqual(buildOpenMeteoCache(null), null);
  assert.strictEqual(buildOpenMeteoCache({ current: {} }), null);
});

test('天气：resolveCoords 优先城市坐标，其次定位结果', async () => {
  const { Weather, loadCityData } = loadWeather();
  global.fetch = async (url) => {
    if (String(url).includes('cities.json')) return { ok: true, json: async () => CITIES };
    throw new Error('未预期的请求: ' + url);
  };
  await loadCityData();

  // 手动选了城市 → 用该城市坐标，定位结果不参与
  Weather.selectedCityQuery = 'Shenzhen';
  Weather.coords = { lat: '1.00', lng: '2.00' };
  const byCity = Weather.resolveCoords();
  assert.ok(byCity && Math.abs(byCity.lat - 22.54) < 0.6 && Math.abs(byCity.lon - 114.06) < 0.6,
    `深圳坐标应来自 cities.json，实际 ${JSON.stringify(byCity)}`);

  // 选了城市但该城市没有坐标 → 返回 null（不得回退到定位，否则"选了北京却按定位地查"）
  const shenzhen = cityByQuery('Shenzhen');
  const savedLat = shenzhen.lat;
  delete shenzhen.lat;
  assert.strictEqual(Weather.resolveCoords(), null, '城市无坐标时不得回退到定位结果');
  shenzhen.lat = savedLat;

  // 未选城市 → 用定位结果（IP 定位兜底就是走这条）
  Weather.selectedCityQuery = '';
  Weather.coords = { lat: '30.67', lng: '104.07' };
  assert.deepStrictEqual(Weather.resolveCoords(), { lat: 30.67, lon: 104.07 });

  // 既无城市也无定位 → null，备用源不可用
  Weather.coords = null;
  assert.strictEqual(Weather.resolveCoords(), null);
});

test('天气容灾链：主源失败时自动回退 Open-Meteo 并落到缓存（本次故障的核心回归）', async () => {
  const { Weather, loadCityData } = loadWeather();
  const seen = [];
  global.fetch = async (url) => {
    const u = String(url);
    seen.push(u);
    if (u.includes('cities.json')) return { ok: true, json: async () => CITIES };
    if (u.includes('wttr.in')) throw new TypeError('fetch failed: certificate has expired');
    if (u.includes('api.open-meteo.com')) return { ok: true, json: async () => MOCK_OPEN_METEO };
    throw new Error('未预期的请求: ' + u);
  };
  await loadCityData();

  Weather.cache = null;
  Weather._failed = false;
  Weather.selectedCityQuery = 'Shenzhen';
  Weather.render = () => {}; // 渲染依赖 DOM，这里只验证数据链路

  await Weather.refresh();

  assert.ok(seen.some(u => u.includes('wttr.in')), '应先请求主源');
  assert.ok(seen.some(u => u.includes('api.open-meteo.com')), '主源失败后应请求备用源');
  assert.ok(Weather.cache, '备用源成功时必须有缓存，而不是停在降级态');
  assert.strictEqual(Weather.cache.source, 'open-meteo');
  assert.strictEqual(Weather.cache.desc, '多云');
  assert.strictEqual(Weather._failed, false, '备用源成功后不应保留失败标记');
  // 备用源 URL 必须带上城市坐标，这是它能替代城市名查询的前提
  const omUrl = seen.find(u => u.includes('api.open-meteo.com'));
  assert.match(omUrl, /latitude=22\.5/, `备用源 URL 应含深圳纬度: ${omUrl}`);
  assert.match(omUrl, /timezone=auto/, '必须由数据源按时区返回当地时间，否则小时轴会错位');
});

test('天气容灾链：两个源都失败时置失败标记，且不覆盖已有缓存', async () => {
  const { Weather, loadCityData } = loadWeather();
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('cities.json')) return { ok: true, json: async () => CITIES };
    throw new TypeError('fetch failed');
  };
  await loadCityData();

  Weather.selectedCityQuery = 'Shenzhen';
  Weather.render = () => {};
  const stale = { temp: '18', icon: '☀️', desc: '晴', hourly: null, timestamp: 1, version: 7 };
  Weather.cache = stale;
  Weather._failed = false;

  await Weather.refresh();

  assert.strictEqual(Weather._failed, true, '两个源都失败应标记失败');
  assert.strictEqual(Weather.cache, stale, '失败时保留上一次的缓存数据（US-21 降级语义）');
});

test('天气容灾链：无城市且无坐标时不请求备用源（避免发出无效查询）', async () => {
  const { Weather, loadCityData } = loadWeather();
  const seen = [];
  global.fetch = async (url) => {
    const u = String(url);
    seen.push(u);
    if (u.includes('cities.json')) return { ok: true, json: async () => CITIES };
    throw new TypeError('fetch failed');
  };
  await loadCityData();

  Weather.selectedCityQuery = '';
  Weather.coords = null;
  Weather.cache = null;
  Weather._failed = false;
  Weather.render = () => {};
  await Weather.refresh();

  assert.ok(!seen.some(u => u.includes('api.open-meteo.com')), '没有经纬度时不应请求备用源');
  assert.strictEqual(Weather._failed, true);
});
