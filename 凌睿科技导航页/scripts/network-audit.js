/**
 * PBI-14 网络请求审计与无埋点回归防护（US-16）
 *
 * 统一注册表：所有允许的第三方请求在此声明（域名/用途/触发条件）。
 * - isAllowed(url, pageUrl)：判断请求是否在白名单内（同源资源豁免）
 * - installAudit()：包装 window.fetch，白名单外请求输出 console.warn（开发期审计日志）
 * - 完整审计（img/背景图等非 fetch 请求）由 E2E 冒烟断言覆盖（nav-e2e.js [12]）
 *
 * 白名单口径（2026-09-01 决策，对应 P2-2）：
 * - favicon.im 及其 CDN 子域（*.favicon.im，运行时实测重定向到 a.favicon.im）
 * - 书签图标兜底「任意域 /favicon.ico」以路径规则豁免（favicon.im 失败时回退，
 *   是书签可读性核心功能，隐私 tab 已声明书签域名外发）
 * - 页面同源资源（cities.json 等本地文件）豁免
 * - manifest host_permissions 与 CSP connect-src 域名均须是本清单的子集（单测断言）
 */
const NETWORK_ALLOWLIST = [
  { host: 'wttr.in', purpose: '天气查询（天气组件）', trigger: '天气组件刷新/城市切换' },
  { host: 'cn.bing.com', purpose: 'Bing 每日壁纸（HPImageArchive 接口）', trigger: '壁纸源为 Bing 每日且当日无缓存' },
  { host: 'bing.biturl.top', purpose: '随机壁纸（背景图）', trigger: '壁纸源为随机' },
  { host: 'cdn.jsdelivr.net', purpose: '节假日数据主源（holiday-cn）', trigger: '日历初始化且缓存过期' },
  { host: 'raw.githubusercontent.com', purpose: '节假日数据备源', trigger: '主源失败' },
  { host: '*.favicon.im', purpose: '书签图标服务（含 CDN 子域，如 a.favicon.im）', trigger: '书签渲染' }
];

/* 书签图标兜底例外：任意 https 域名的 /favicon.ico（main.js favicon fallback） */
const FAVICON_FALLBACK_RULE = /\/favicon\.ico$/i;

function matchHost(rule, host) {
  if (rule.startsWith('*.')) {
    // *.favicon.im 匹配裸域 favicon.im 及其任意子域（去掉通配前缀 "*."）
    const base = rule.slice(2);
    return host === base || host.endsWith('.' + base);
  }
  return host === rule;
}

/** 判断请求是否在白名单内；pageUrl 用于同源豁免（页面自身资源） */
function isAllowed(url, pageUrl) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (pageUrl) {
    try {
      if (new URL(pageUrl).origin === u.origin) return true;
    } catch { /* 忽略 */ }
  }
  const host = u.hostname.toLowerCase();
  if (NETWORK_ALLOWLIST.some(e => matchHost(e.host, host))) return true;
  if (FAVICON_FALLBACK_RULE.test(u.pathname) && (u.protocol === 'https:' || u.protocol === 'http:')) return true;
  return false;
}

/** 开发期审计日志：包装 fetch，白名单外请求 console.warn（幂等） */
function installAudit() {
  if (typeof window === 'undefined' || window.__lingruiAuditInstalled) return;
  window.__lingruiAuditInstalled = true;
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const raw = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
    if (raw && !isAllowed(raw, window.location.href)) {
      console.warn(`[network-audit] 白名单外请求被记录: ${raw}（请确认是否需要注册到 NETWORK_ALLOWLIST）`);
    }
    return origFetch.apply(this, args);
  };
}

/* 浏览器以 <script> 全局加载时自动安装；Node 测试环境跳过 */
if (typeof window !== 'undefined') installAudit();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NETWORK_ALLOWLIST, FAVICON_FALLBACK_RULE, isAllowed, installAudit, matchHost };
}
