const HOLIDAY_CACHE_KEY = 'holidayCacheV1';
const HOLIDAY_CACHE_DURATION = 24 * 60 * 60 * 1000;

/* 内置兜底数据由 lunar-javascript 的 HolidayUtil 生成（ADV-14）。
   lunar 1.7.7 内置 2018-2026 的法定节假日/调休数据，随库升级获得新年份；
   不再手工维护 2026 表（旧表与国务院公告有 5 处不一致，见 CHANGELOG 1.1.3）。
   范围取「当前年 -1 ~ 当前年 +1」：跨年时仍有上一年的历史标记，
   下一年公告发布后升级库即可补上。 */
function buildHolidayFallback(baseYear = new Date().getFullYear()) {
  const map = {};
  if (typeof HolidayUtil === 'undefined' || !HolidayUtil) return map;
  for (let y = baseYear - 1; y <= baseYear + 1; y++) {
    let list = [];
    try { list = HolidayUtil.getHolidays(y) || []; } catch { list = []; }
    for (const h of list) {
      if (!h || typeof h.getDay !== 'function') continue;
      map[h.getDay()] = {
        // HolidayUtil 的调休名称带「调休」后缀，UI 已有「今日调休上班」前缀，去掉避免重复
        name: String(h.getName() || '').replace(/调休$/, ''),
        off: !h.isWork()
      };
    }
  }
  return map;
}
const HOLIDAY_FALLBACK = buildHolidayFallback();

/* 合并兜底数据：上次成功拉取的缓存（可能已过期）优先于库内置的历史表。
   这样客户只要联网成功过一次，之后断网、缓存过期也能继续用最近一次的数据；
   lunar 不再需要每年升级来追赶新年份，维护者也不需要每年手动操作。 */
function mergeHolidayFallback(stale, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const extra = stale && typeof stale === 'object' ? stale : {};
  return Object.assign({}, base, extra);
}

const Calendar = {
  holidays: {},
  loaded: false,
  viewYear: 0,
  viewMonth: 0,
  holidaySource: 'unknown', // PBI-12：'network' | 'cache' | 'partial' | 'fallback'

  async init() {
    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth() + 1;
    this.holidays = Object.assign({}, HOLIDAY_FALLBACK);
    await this.loadHolidays();
    this.loaded = true;
  },

  prevMonth() {
    if (this.viewMonth === 1) { this.viewMonth = 12; this.viewYear--; }
    else { this.viewMonth--; }
    this.rerenderCard();
  },

  nextMonth() {
    if (this.viewMonth === 12) { this.viewMonth = 1; this.viewYear++; }
    else { this.viewMonth++; }
    this.rerenderCard();
  },

  resetView() {
    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth() + 1;
    this.rerenderCard();
  },

  bindCardEvents(card) {
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      switch (btn.dataset.action) {
        case 'prev-month': this.prevMonth(); break;
        case 'next-month': this.nextMonth(); break;
        case 'reset-view': this.resetView(); break;
      }
    });
  },

  rerenderCard() {
    const el = document.getElementById('datetime');
    if (!el) return;
    const card = el.querySelector('.datetime-hover-card');
    if (card) {
      const wrap = document.createElement('div');
      wrap.innerHTML = this.render();
      const child = wrap.firstElementChild;
      if (child) card.innerHTML = child.innerHTML;
    }
  },

  async loadHolidays() {
    // 缓存即使过期也先留着：双源都失败时，它比库内置的历史表更新
    let staleData = null;
    try {
      const cached = localStorage.getItem(HOLIDAY_CACHE_KEY);
      if (cached) {
        const obj = JSON.parse(cached);
        if (obj && obj.data && Object.keys(obj.data).length > 0) {
          staleData = obj.data;
          if (Date.now() - obj.timestamp < HOLIDAY_CACHE_DURATION) {
            this.holidays = mergeHolidayFallback(obj.data, HOLIDAY_FALLBACK);
            this.holidaySource = 'cache';
            return;
          }
        }
      }
    } catch {}

    const year = new Date().getFullYear();
    const years = [year, year + 1];
    const merged = {};
    let okYears = 0;
    for (const y of years) {
      const data = await this.fetchYear(y);
      if (data) {
        Object.assign(merged, data);
        okYears++;
      }
    }
    // PBI-12：记录数据源状态，用于浮层标注"数据可能不完整"（US-14 AC2）
    if (okYears === years.length) this.holidaySource = 'network';
    else if (okYears > 0) this.holidaySource = 'partial';
    else this.holidaySource = 'fallback';
    if (Object.keys(merged).length > 0) {
      this.holidays = Object.assign({}, HOLIDAY_FALLBACK, merged);
      try {
        localStorage.setItem(HOLIDAY_CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: merged
        }));
      } catch {}
    } else {
      // 双源均失败：优先用上次成功的数据（哪怕已过期），其次库内置历史表。
      // 客户端因此不需要每年等扩展升级；lunar 不升级也能拿到新一年数据。
      this.holidays = mergeHolidayFallback(staleData, HOLIDAY_FALLBACK);
      this.holidaySource = staleData ? 'cache' : 'fallback';
    }
  },

  async fetchYear(year) {
    const urls = [
      `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
      `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`
    ];
    for (const url of urls) {
      const controller = new AbortController();
      // 超时须覆盖整轮请求（含 response.json() 的响应体读取），并在 finally 中清理，
      // 否则响应头返回后 body 挂起时既不超时、也感知不到失败，会一直阻塞日历初始化
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) continue;
        const json = await resp.json();
        if (!Array.isArray(json.days)) continue;
        const map = {};
        for (const d of json.days) {
          map[d.date] = { name: d.name, off: !!d.isOffDay };
        }
        return map;
      } catch {} finally {
        clearTimeout(timeoutId);
      }
    }
    return null;
  },

  pad(n) {
    return String(n).padStart(2, '0');
  },

  formatDate(y, m, d) {
    return `${y}-${this.pad(m)}-${this.pad(d)}`;
  },

  getMonthMatrix(year, month) {
    const first = new Date(year, month - 1, 1);
    const firstDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevDays = new Date(year, month - 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDow; i++) {
      const d = prevDays - firstDow + 1 + i;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      cells.push({ y: prevYear, m: prevMonth, d, outside: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ y: year, m: month, d, outside: false });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1];
      const nextMonth = last.m === 12 ? 1 : last.m + 1;
      const nextYear = last.m === 12 ? last.y + 1 : last.y;
      const nextD = (last.outside && last.m !== month) ? last.d + 1 : cells.length - firstDow - daysInMonth + 1;
      cells.push({ y: nextYear, m: nextMonth, d: nextD, outside: true });
    }
    return cells;
  },

  getLunarLabel(y, m, d) {
    if (typeof Solar === 'undefined') return '';
    try {
      const solar = Solar.fromYmd(y, m, d);
      const lunar = solar.getLunar();
      const jieqi = lunar.getJieQi();
      if (jieqi) return jieqi;
      const day = lunar.getDay();
      if (day === 1) {
        const monthName = lunar.getMonthInChinese();
        return monthName + '月';
      }
      return lunar.getDayInChinese();
    } catch {
      return '';
    }
  },

  getGanZhiHeader(y, m) {
    if (typeof Solar === 'undefined') return `${y} 年 ${m} 月`;
    try {
      const lunar = Solar.fromYmd(y, m, 15).getLunar();
      return `${y} 年 ${m} 月 · 农历${lunar.getYearInGanZhi()}年 ${lunar.getMonthInChinese()}月`;
    } catch {
      return `${y} 年 ${m} 月`;
    }
  },

  /* PBI-11：下一个法定节假日倒计时（US-12）；无数据/无未来假日返回 null */
  getNextHoliday() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayKey = this.formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const todayH = this.holidays[todayKey];

    let next = null;
    for (const [date, h] of Object.entries(this.holidays)) {
      if (!h || !h.off) continue;
      const parts = String(date).split('-').map(Number);
      if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) continue;
      const ts = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      if (ts < todayStart) continue;
      const days = Math.round((ts - todayStart) / 86400000);
      if (!next || ts < next.ts) next = { ts, days, name: h.name };
    }
    return { todayH, next };
  },

  /* PBI-12：数据源状态标注文案（fallback/partial 时显示，US-14 AC2/UC-09 2a） */
  getSourceNote() {
    if (this.holidaySource === 'fallback' || this.holidaySource === 'partial') {
      return '<div class="dhc-source-note">节假日数据可能不完整</div>';
    }
    return '';
  },

  render() {
    const now = new Date();
    const year = this.viewYear;
    const month = this.viewMonth;
    const today = now.getDate();
    const todayKey = this.formatDate(now.getFullYear(), now.getMonth() + 1, today);

    const cells = this.getMonthMatrix(year, month);
    const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
    const weekRow = weekdays.map((w, i) =>
      `<div class="dhc-week ${i >= 5 ? 'dhc-weekend' : ''}">${w}</div>`
    ).join('');

    // PBI-11：节假日倒计时行（今天放假 / 今日调休 / 下个节假日还有 N 天）
    let countdown = '';
    const { todayH, next } = this.getNextHoliday();
    if (todayH) {
      countdown = todayH.off
        ? `<div class="dhc-countdown">今天 · ${escapeHtml(todayH.name)}（放假）</div>`
        : `<div class="dhc-countdown">今日调休上班 · ${escapeHtml(todayH.name)}</div>`;
    } else if (next && next.days > 0) {
      countdown = `<div class="dhc-countdown">${escapeHtml(next.name)}还有 ${next.days} 天</div>`;
    }

    const dayCells = cells.map(cell => {
      const key = this.formatDate(cell.y, cell.m, cell.d);
      const dow = (new Date(cell.y, cell.m - 1, cell.d).getDay() + 6) % 7;
      const isWeekend = dow >= 5;
      const isToday = key === todayKey;
      const holiday = this.holidays[key];
      const lunar = this.getLunarLabel(cell.y, cell.m, cell.d);

      const classes = ['dhc-cell'];
      if (cell.outside) classes.push('dhc-outside');
      if (isWeekend && !cell.outside) classes.push('dhc-weekend');
      if (isToday) classes.push('dhc-today');
      if (holiday && !cell.outside) {
        classes.push(holiday.off ? 'dhc-off' : 'dhc-work');
      }

      const badge = holiday && !cell.outside
        ? `<span class="dhc-badge dhc-badge-${holiday.off ? 'off' : 'work'}"></span>`
        : '';
      const title = holiday
        ? `${holiday.name}${holiday.off ? ' · 放假' : ' · 调休上班'}`
        : lunar;

      return `
        <div class="${classes.join(' ')}" title="${escapeAttr(title)}">
          ${badge}
          <div class="dhc-day">${cell.d}</div>
          <div class="dhc-sub">${lunar}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="datetime-hover-card" role="tooltip">
        <div class="dhc-header">
          <button class="dhc-nav" data-action="prev-month">◀</button>
          ${this.getGanZhiHeader(year, month)}
          <button class="dhc-nav" data-action="next-month">▶</button>
          <button class="dhc-nav dhc-nav-today" data-action="reset-view" title="回到今天">●</button>
        </div>
        ${countdown}
        ${this.getSourceNote()}
        <div class="dhc-week-row">${weekRow}</div>
        <div class="dhc-grid">${dayCells}</div>
      </div>
    `;
  }
};

if (typeof window !== 'undefined') window.Calendar = Calendar;

/* Node 单测入口：buildHolidayFallback 是纯函数（依赖全局 HolidayUtil），
   单独导出便于验证内置兜底数据与国务院公告一致（ADV-14） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Calendar, buildHolidayFallback, mergeHolidayFallback };
}
