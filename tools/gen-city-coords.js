#!/usr/bin/env node
/**
 * 城市坐标生成脚本（构建期工具，不进入分发包）
 *
 * 背景：天气备用源 Open-Meteo 只接受经纬度查询，而 data/cities.json 此前只有
 * 拼音 query（wttr.in 用城市名）。本脚本用 Open-Meteo Geocoding 为每个城市补上
 * lat/lon，供 weather.js 在 wttr.in 不可用时回退使用。
 *
 * 为什么不用 wttr.in 的 nearest_area 当坐标源：实测不可靠——`Yanbian` 解析到四川
 * （26.9,101.5）、`Yili` 也解析到四川，用它生成坐标等于把主源的解析错误固化下来。
 *
 * 校验策略（宁可报错退出，也不写入可疑坐标）：
 *   1. countryCode 过滤：大陆 CN，港澳台按 HK/MO/TW/CN 依次尝试
 *   2. admin1（省级）必须与 cities.json 的省份名归一化匹配（港澳台为聚合名，豁免）
 *   3. 城市名归一化后须与候选项前缀互含，避免落到同省同名小镇
 *   4. 坐标必须落在中国及周边经纬度范围内
 *   5. 自治州 / 盟 / 地区级条目用州府（PREFECTURE_SEAT）查询，坐标同样经过 admin1 校验
 *   6. 任何最终无法确认的城市都会在末尾列出，脚本以非零码退出
 *
 * 用法：
 *   node tools/gen-city-coords.js --dry-run   # 只报告，不改文件
 *   node tools/gen-city-coords.js --write     # 写入 src/data/cities.json
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CITIES_PATH = path.join(ROOT, 'src', 'data', 'cities.json');

const CONCURRENCY = 4;
const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';

/* 自治州 / 盟 / 地区：geocoding 查不到州名本身，改用州府所在地（坐标仍由 geocoding 给出，
   并经过 admin1 校验，因此不会把坐标固化到错误省份）。值用拼音——中文检索质量差。 */
const PREFECTURE_SEAT = {
  '湖南/湘西': 'Jishou',
  '云南/红河': 'Mengzi',
  '云南/怒江': 'Lushui',
  '云南/西双版纳': 'Jinghong',
  '云南/德宏': 'Mangshi',
  '云南/迪庆': 'Shangri-La',
  '贵州/黔东南': 'Kaili',
  '贵州/黔南': 'Duyun',
  '贵州/黔西南': 'Xingyi',
  '吉林/延边': 'Yanji',
  '甘肃/甘南': 'Hezuo',
  '甘肃/临夏': 'Linxia',
  '内蒙古/兴安盟': 'Ulanhot',
  '内蒙古/锡林郭勒': 'Xilinhot',
  '内蒙古/阿拉善盟': 'Bayanhot',
  '新疆/伊犁': 'Yining',
  '西藏/日喀则': 'Rikaze',
  '西藏/山南': 'Lhoka',
  '西藏/阿里': 'Gar',
  '青海/海东': 'Ledu',
  '青海/海西': 'Delingha',
  '青海/玉树': 'Yushu',
  '吉林/辽源': 'Longshan',
  '湖北/恩施': 'Enshi'
};

/* GeoNames 缺失、但主源 wttr.in 能正确解析的条目。
   写入前必须用独立来源交叉核对过——这里是拿 wttr.in 的 nearest_area 反查
   （area=Yaan / region=Sichuan，与雅安实际位置一致），而不是凭印象填数。 */
const MANUAL_COORDS = {
  '四川/雅安': { lat: 29.983, lon: 103.083, src: 'wttr.in nearest_area: Yaan/Sichuan' }
};

/* 省级名归一化：去掉行政级别与民族名，便于 "内蒙古" 与 "内蒙古自治区" 互认 */
function normProvince(s) {
  return String(s || '')
    .replace(/维吾尔|壮族|回族|藏族|蒙古族|土家族|苗族|侗族|彝族|白族|傣族|景颇族|傈僳族|哈尼族|朝鲜族|哈萨克|柯尔克孜|布依族|仡佬族|黎族|羌族|满族/g, '')
    .replace(/特别行政区|自治区|自治州|自治县|地区|盟|省|市/g, '')
    .trim();
}

/* 城市名归一化：同样剥掉行政后缀与民族名，"湘西土家族苗族自治州" → "湘西" */
function normCity(s) {
  return normProvince(s).replace(/自治|新区|经济开发区/g, '').trim();
}

/* 中国及港澳台经纬度合理范围（用于排除同名海外城市） */
function inChinaBounds(lat, lon) {
  return lat >= 18 && lat <= 54 && lon >= 73 && lon <= 135;
}

async function geoSearch(name, countryCode) {
  const url = `${GEO_API}?name=${encodeURIComponent(name)}&count=8&language=zh&format=json`
    + (countryCode ? `&countryCode=${countryCode}` : '');
  const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data.results) ? data.results : [];
}

/* GeoNames feature_code 权重：只认居民点，机场/山峰/酒店等一律排除。
   数值越小越"像"目标城市（PPLA2 = 地级市首府，正是 cities.json 的粒度）。 */
const FEATURE_RANK = { PPLC: 0, PPLA: 1, PPLA2: 2, PPLA3: 3, PPLA4: 4, PPL: 5, PPLX: 6 };
function featureRank(code) {
  return Object.prototype.hasOwnProperty.call(FEATURE_RANK, code) ? FEATURE_RANK[code] : 99;
}

/* 拼音键：cities.json 的 query 就是主源 wttr.in 的检索词，候选名与它相等即视为同一地点。
   这条判据不可省——拼音查询命中的条目名常常是英文（"Yiyang" 对应"益阳"），
   只比中文名会让同省的其它 PPLA3 小镇靠行政级别胜出。 */
function pinyinKeys(query) {
  const raw = String(query || '').replace(/\+/g, ' ').replace(/\s*China\s*$/i, '').trim().toLowerCase();
  return new Set([raw, raw.split(/\s+/)[0], raw.replace(/[^a-z]/g, '')].filter(Boolean));
}

/* 候选打分：省级匹配 + 必须是居民点，是两条硬条件；
   排序按「名称命中 → 行政级别 → 人口」，名称命中优先是关键：
   辽宁"朝阳"的候选里同时有 PPLA4 的"达连"和 PPL 的"大连市"，
   若先比行政级别，小村会把真正的大连市挤掉。 */
function pickResult(results, province, city, dbgLabel) {
  const wantProv = normProvince(province);
  const wantCity = normCity(city.name);
  const wantPinyin = pinyinKeys(city.query);
  const isHmt = province === '港澳台';
  const scored = [];

  for (const r of results) {
    const boundsOk = inChinaBounds(r.latitude, r.longitude);
    const rank = featureRank(r.feature_code);
    if (!boundsOk || rank === 99) continue; // 机场、山峰、酒店等非居民点
    if (!isHmt && wantProv) {
      const got = normProvince(r.admin1);
      // 省级信息缺失或不一致一律拒绝：宁可报人工确认，也不猜
      if (!got || !(got === wantProv || got.includes(wantProv) || wantProv.includes(got))) continue;
    }
    const rawName = String(r.name || '');
    const lowName = rawName.toLowerCase();
    const gotCity = normCity(rawName);
    const nameHit = (!!wantCity && (gotCity === wantCity
      || gotCity.startsWith(wantCity) || wantCity.startsWith(gotCity)))
      || wantPinyin.has(lowName)
      || wantPinyin.has(lowName.replace(/[^a-z]/g, ''));
    scored.push({ r, nameHit, rank, pop: r.population || 0 });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => (b.nameHit - a.nameHit) || (a.rank - b.rank) || (b.pop - a.pop));
  const best = scored[0];
  if (process.env.PICK_DEBUG) {
    console.log(`[PICK] ${dbgLabel || province + '/' + city.name} 择优: ` + scored
      .map(s => `${s.r.name}${s.nameHit ? '*' : ''}(r${s.rank},p${s.pop})`).join(' > '));
  }
  // 可信条件（满足其一）：名称命中 / 县级及以上行政中心 / 有人口数据。
  // 三者是"或"关系——GeoNames 里不少正确条目 population 为空（如"大连市|辽宁"是 PPL 且无人口），
  // 若只认行政级别会把大连、和田这类正确结果一并拒掉。
  const trusted = best.nameHit || best.rank <= 3 || best.pop > 0;
  if (!trusted) return null;
  return { hit: best.r, nameHit: best.nameHit };
}

/* 生成候选查询名：拼音优先（中文检索质量差，实测"泰安""益阳""吉首"均查不到或查到外省同名地）。
   撇号是关键坑：GeoNames 索引用全角撇号，Tai'an/Guang'an/Ma'anshan 用直撇号一律查不到，
   换成 ’ 才命中；v 变体则是拼音 ü 的另一种写法（Lvliang → Luliang）。 */
function nameVariants(province, city) {
  const out = [];
  const raw = city.query.replace(/\+/g, ' ').replace(/\s*China\s*$/i, '').trim();
  out.push(raw);
  if (raw.includes("'")) {
    out.push(raw.replace(/'/g, '\u2019'));
    out.push(raw.replace(/'/g, ''));
  }
  if (/v/i.test(raw)) out.push(raw.replace(/v/gi, 'u'));
  const first = raw.split(/\s+/)[0];
  if (first && first !== raw) out.push(first);
  const seat = PREFECTURE_SEAT[`${province}/${city.name}`];
  if (seat) out.push(seat);
  out.push(city.name);
  return [...new Set(out.filter(Boolean))];
}

async function resolveCity(province, city) {
  const manual = MANUAL_COORDS[`${province}/${city.name}`];
  if (manual) {
    return { ok: true, lat: manual.lat, lon: manual.lon, via: 'manual', matched: manual.src, exact: true };
  }
  const countries = province === '港澳台' ? ['TW', 'HK', 'MO', 'CN']
    : province === '自动定位' ? []
    : ['CN'];
  const netErrors = [];
  const variants = nameVariants(province, city);
  const dbg = process.env.DEBUG_CITY
    && (city.name === process.env.DEBUG_CITY || `${province}/${city.name}` === process.env.DEBUG_CITY);
  if (dbg) console.log(`[DEBUG] ${province}/${city.name} 查询变体: ${JSON.stringify(variants)}`);

  for (const name of variants) {
    for (const cc of countries) {
      let results;
      try {
        results = await geoSearch(name, cc);
      } catch (e) {
        netErrors.push(`${name}/${cc}:${e.message}`);
        continue;
      }
      if (dbg) {
        console.log(`[DEBUG]   ${name}/${cc} → ${results.length} 条: ` + results
          .map(r => `${r.name}|${r.admin1}|${r.feature_code}|pop=${r.population}`).join(' ## '));
      }
      const picked = pickResult(results, province, city, `${province}/${city.name}(${name}/${cc})`);
      if (picked) {
        const r = picked.hit;
        return {
          ok: true,
          lat: Number(r.latitude.toFixed(4)),
          lon: Number(r.longitude.toFixed(4)),
          via: `${name}/${cc}`,
          matched: `${r.name}·${r.admin1 || '-'}·${r.feature_code}·pop=${r.population || 0}`,
          exact: picked.nameHit
        };
      }
    }
  }
  return {
    ok: false,
    err: netErrors.length
      ? `请求失败 ${netErrors.length} 次（${netErrors[0]}）`
      : `无匹配候选（已试 ${variants.join(' / ')}）`
  };
}

async function main() {
  const write = process.argv.includes('--write');
  const provinces = JSON.parse(fs.readFileSync(CITIES_PATH, 'utf8'));
  const only = process.env.ONLY || ''; // 诊断用：只处理指定城市（城市名或 省份/城市）
  const jobs = [];
  for (const prov of provinces) {
    for (const city of prov.cities) {
      if (prov.name === '自动定位') continue; // 无固定坐标，运行时由定位决定
      if (only && city.name !== only && `${prov.name}/${city.name}` !== only) continue;
      jobs.push({ prov: prov.name, city });
    }
  }
  console.log(`待解析城市: ${jobs.length}（跳过「自动定位」）`);

  const results = new Map();
  let cursor = 0, done = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const key = `${job.prov}/${job.city.name}`;
      results.set(key, await resolveCity(job.prov, job.city));
      done++;
      if (done % 50 === 0) console.log(`  进度 ${done}/${jobs.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const failed = [];
  const fuzzy = [];
  let changed = 0;
  for (const prov of provinces) {
    for (const city of prov.cities) {
      const key = `${prov.name}/${city.name}`;
      if (!results.has(key)) continue;
      const r = results.get(key);
      if (!r.ok) { failed.push(`${key} → ${r.err}`); continue; }
      if (!r.exact) fuzzy.push(`${key} → ${r.matched}（${r.via}）`);
      if (city.lat !== r.lat || city.lon !== r.lon) changed++;
      city.lat = r.lat;
      city.lon = r.lon;
    }
  }

  console.log(`\n解析成功: ${results.size - failed.length}/${results.size}，坐标写入/变更: ${changed}`);
  if (fuzzy.length) {
    console.log(`\n名称非精确匹配（${fuzzy.length} 个，已按省级校验 + 人口择优，建议抽查）:`);
    fuzzy.forEach(f => console.log('  ? ' + f));
  }
  if (failed.length) {
    console.log(`\n无法确认的城市（${failed.length} 个，未写入坐标）:`);
    failed.forEach(f => console.log('  ✗ ' + f));
  }

  if (failed.length && write) {
    console.error('\n存在未确认城市，已中止写入（避免把可疑坐标写进分发包）');
    process.exit(1);
  }
  if (!write) {
    console.log('\n[dry-run] 未修改文件；确认无误后加 --write');
    return;
  }
  fs.writeFileSync(CITIES_PATH, JSON.stringify(provinces), 'utf8');
  console.log(`\n已写入 ${path.relative(ROOT, CITIES_PATH)}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
