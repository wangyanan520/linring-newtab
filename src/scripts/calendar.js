const HOLIDAY_CACHE_KEY = 'holidayCacheV1';
const HOLIDAY_CACHE_DURATION = 24 * 60 * 60 * 1000;

const HOLIDAY_FALLBACK = {
  '2026-01-01': { name: '元旦', off: true },
  '2026-01-02': { name: '元旦', off: true },
  '2026-01-03': { name: '元旦', off: true },
  '2026-02-15': { name: '春节', off: false },
  '2026-02-16': { name: '春节', off: true },
  '2026-02-17': { name: '春节', off: true },
  '2026-02-18': { name: '春节', off: true },
  '2026-02-19': { name: '春节', off: true },
  '2026-02-20': { name: '春节', off: true },
  '2026-02-21': { name: '春节', off: true },
  '2026-02-22': { name: '春节', off: true },
  '2026-02-23': { name: '春节', off: true },
  '2026-02-24': { name: '春节', off: true },
  '2026-02-28': { name: '春节', off: false },
  '2026-04-04': { name: '清明节', off: true },
  '2026-04-05': { name: '清明节', off: true },
  '2026-04-06': { name: '清明节', off: true },
  '2026-05-01': { name: '劳动节', off: true },
  '2026-05-02': { name: '劳动节', off: true },
  '2026-05-03': { name: '劳动节', off: true },
  '2026-05-04': { name: '劳动节', off: true },
  '2026-05-05': { name: '劳动节', off: true },
  '2026-04-26': { name: '劳动节', off: false },
  '2026-05-09': { name: '劳动节', off: false },
  '2026-06-19': { name: '端午节', off: true },
  '2026-06-20': { name: '端午节', off: true },
  '2026-06-21': { name: '端午节', off: true },
  '2026-09-25': { name: '中秋节', off: true },
  '2026-09-26': { name: '中秋节', off: true },
  '2026-09-27': { name: '中秋节', off: true },
  '2026-10-01': { name: '国庆节', off: true },
  '2026-10-02': { name: '国庆节', off: true },
  '2026-10-03': { name: '国庆节', off: true },
  '2026-10-04': { name: '国庆节', off: true },
  '2026-10-05': { name: '国庆节', off: true },
  '2026-10-06': { name: '国庆节', off: true },
  '2026-10-07': { name: '国庆节', off: true },
  '2026-10-08': { name: '国庆节', off: true },
  '2026-10-10': { name: '国庆节', off: false }
};

const Calendar = {
  holidays: {},
  loaded: false,

  async init() {
    this.holidays = Object.assign({}, HOLIDAY_FALLBACK);
    await this.loadHolidays();
    this.loaded = true;
  },

  async loadHolidays() {
    try {
      const cached = localStorage.getItem(HOLIDAY_CACHE_KEY);
      if (cached) {
        const obj = JSON.parse(cached);
        if (Date.now() - obj.timestamp < HOLIDAY_CACHE_DURATION) {
          this.holidays = Object.assign({}, HOLIDAY_FALLBACK, obj.data);
          return;
        }
      }
    } catch {}

    const year = new Date().getFullYear();
    const years = [year, year + 1];
    const merged = {};
    for (const y of years) {
      const data = await this.fetchYear(y);
      if (data) Object.assign(merged, data);
    }
    if (Object.keys(merged).length > 0) {
      this.holidays = Object.assign({}, HOLIDAY_FALLBACK, merged);
      try {
        localStorage.setItem(HOLIDAY_CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: merged
        }));
      } catch {}
    }
  },

  async fetchYear(year) {
    const urls = [
      `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
      `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`
    ];
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!resp.ok) continue;
        const json = await resp.json();
        if (!Array.isArray(json.days)) continue;
        const map = {};
        for (const d of json.days) {
          map[d.date] = { name: d.name, off: !!d.isOffDay };
        }
        return map;
      } catch {}
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

  render() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const today = now.getDate();
    const todayKey = this.formatDate(year, month, today);

    const cells = this.getMonthMatrix(year, month);
    const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
    const weekRow = weekdays.map((w, i) =>
      `<div class="dhc-week ${i >= 5 ? 'dhc-weekend' : ''}">${w}</div>`
    ).join('');

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
        <div class="${classes.join(' ')}" title="${title}">
          ${badge}
          <div class="dhc-day">${cell.d}</div>
          <div class="dhc-sub">${lunar}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="datetime-hover-card" role="tooltip">
        <div class="dhc-header">${this.getGanZhiHeader(year, month)}</div>
        <div class="dhc-week-row">${weekRow}</div>
        <div class="dhc-grid">${dayCells}</div>
      </div>
    `;
  }
};
