# 第四轮对抗式审查报告（2026-10-17）

**审查对象**：凌睿科技导航页 V3/V4（`src/`，manifest 版本 1.1.0）
**审查方法**：全部运行时源码逐行重读 → 建立攻击假设 → 对每条假设做可复现验证（Node PoC / 代码路径推演 / 对照实现）→ 自我证伪后再定级。
**验证基线**：`npm test` = 67/67 通过（本轮发现的所有缺陷均存在于全绿基线之下）。
**与前三轮的关系**：本轮只报前三轮（`review-report-adversarial.md`）与 V4 优化后**新发现或遗留**的问题；前三轮已记录的决策项（chrome-extension 协议有意保留、favicon 跨域豁免等）不重复。
**本轮结论**：P0 = 0，P1 = 0，**P2 = 6**，P3 = 12。另记录 1 项初判 P2 后被自我证伪的假设（见 §4）。

---

## 1. 总览

| 编号 | 级别 | 位置 | 一句话 |
|---|---|---|---|
| ADV-01 | **P2** | storage.js L136、L151/172/188/210 | 校验器"最多 8 条错误"上限被凑满后，后续条目**完全不校验**，javascript:/data: URL 与危险 id 可绕过导入 |
| ADV-02 | **P2** | weather.js L703-704 | 天气悬停卡片对缓存里的 `hourly[].icon/temp` 不转义直接拼 innerHTML（主 render 全部转义，hover 遗漏） |
| ADV-03 | **P2** | weather.js L163、L363-364 | `CACHE_VERSION` 只写不读，旧结构缓存恢复时不校验不失效，缺字段渲染出 NaN 布局 |
| ADV-04 | **P2** | weather.js L485-599（赋值在 L594） | 快速切换城市无代次防护，慢响应覆盖快响应，城市标签与天气数据错位并持久化（PoC 实测） |
| ADV-05 | **P2** | wallpaper.js L262-266、L343-347 | 随机壁纸分支不做明度采样，auto 主题对该源永远落 dark；ux-audit 矩阵也不覆盖在线壁纸源 |
| ADV-06 | **P2** | storage.js L307、L322 | chrome.storage 封装从不检查 `runtime.lastError`，生产后端下 reject/回滚路径不可达；单测 mock 用同步 throw 模拟失败，与真实语义不符 |
| ADV-07 | P3 | settings.js L133 | 隐私页写"host_permissions（4 个域名）"，manifest 实际 6 个 |
| ADV-08 | P3 | storage.js L333-339 | settings 键单独缺失时 init 用预设**静默覆盖书签/分类/待办**，无备份 |
| ADV-09 | P3 | storage.js L514-522 | getTodos 读失败返回空数组，界面显空态误导（数据覆盖链不成立，见 §4） |
| ADV-10 | P3 | main.js L11、L46 | 搜索框对任意 `xxx://` 直跳，与书签录入的 http/https/chrome-extension 白名单口径不一 |
| ADV-11 | P3 | main.js COMPONENTS | `defaultVisible` 字段 7 处定义、0 处读取（死字段） |
| ADV-12 | P3 | settings.js L819、weather.js L485/582 | 天气组件被用户隐藏时，导入备份仍无条件发起天气网络请求 |
| ADV-13 | P3 | storage.js L644 | 导入的 settings 无字段白名单，任意键持久化（weatherCity 经分析无法跨主机，仅畸形请求） |
| ADV-14 | P3 | calendar.js L4-44 | HOLIDAY_FALLBACK 硬编码最晚 2026-10-10，双源全失败时 2027 年无兜底 |
| ADV-15 | P3 | storage.js L207-224、todos.js L13 | 导入 todo 不校验 createdAt 类型，缺失时排序比较出 NaN（历史 A14 仍遗留） |
| ADV-16 | P3 | settings.js L71-77 | Esc 全局关闭设置面板，不判断面板/输入框状态 |
| ADV-17 | P3 | storage.js L660 | localStorage 回退分支回滚时可能写入 `"undefined"` 脏值（三条件叠加） |
| ADV-18 | P3 | settings.js L598、L921 | 城市下拉 option 插入未转义（数据来自打包静态 cities.json；同文件 L887 壁纸下拉有 escapeAttr 对照） |

---

## 2. P2 详述

### ADV-01 校验器错误上限截断 → 安全校验整体绕过

**位置**：[storage.js L136](file:///Users/wyn/Dev/浏览器导航页/src/scripts/storage.js#L136) 定义 `limit(errors)`（达 8 条返回 true），在 bookmarks / categories / items / todos 四个校验循环的开头各有一处 `if (limit(errors)) break;`（L151、L172、L188、L210）。

**问题**：上限的本意是收敛报错文案，但它被放在了**校验循环**而不是报错展示处。任意攻击者只需在备份前面放 8 个"无害但报错"的条目（如 title 全空格），第 9 条起的恶意内容就完全跳过校验；bookmarks 凑满后，categories 内的条目连同一并跳过。

**复现**（Node 直跑，已实测）：

```js
const { validateBackup } = require('./src/scripts/storage.js');
const evil = { id: 'x"onmouseover="alert(1)', title: 'e', url: 'javascript:alert(1)//' };
const decoys = Array.from({ length: 8 }, (_, i) =>
  ({ id: `d${i}`, title: '   ', url: 'https://example.com' }));
// 恶意条目在第 9 位：errors 恰为 8 条，且无一指向恶意条目 → 导入放行
validateBackup({ bookmarks: [...decoys, evil] });
// 同一恶意条目放在第 1 位时：被"协议不支持"和"id 含不支持的字符"两条同时拦截
```

实测结果：第 9 位放行（8 条错误全部来自诱饵），首位被拦；跨类别复现（bookmarks 凑满后，categories 内 `data:text/html,<script>…` URL 与危险 id 同样漏检）。

**缓解因素（如实记录）**：扩展模式 MV3 CSP（`script-src 'self'`）会拦截 javascript:/data: URL 的脚本执行，历史轮次已实测；危险 id 的选择器注入也不产生脚本执行。残余风险：① 官方支持的 file:// 双击与 preview 模式无 CSP，恶意备份经分享导入后点击即执行（备份是可分享文件，存在供应链面）；② CSP 不防 `<img src=https://外站/>` 类外发与视觉欺骗；③ 校验器是导入链路唯一的内容安全闸，闸口可确定性绕过本身即缺陷（与历史 P2-3 id 白名单同级）。

**修复建议**：校验必须遍历完全部条目；上限只用于展示，例如收集全部错误后 `errors.slice(0, 8)`，或计数后 `continue` 而非 `break`。补一条对抗单测：8 个诱饵 + 1 个恶意条目必须被拒（当前单测只覆盖"单个恶意输入"，无位置/截断用例）。

---

### ADV-02 天气悬停卡片 innerHTML 注入

**位置**：[weather.js L678](file:///Users/wyn/Dev/浏览器导航页/src/scripts/weather.js#L678) `renderHoverCard()`，未转义拼接在 L703-704：

```js
<div class="whc-icon">${showIcon ? h.icon : ''}</div>
<div class="whc-temp">${showIcon ? h.temp + '°' : ''}</div>
```

而主区域 `render()` 对同一批缓存字段全部经 `escapeHtml`（L644-649 一带）。`hourly` 数组的 `icon/temp` 在两条渲染路径上口径不一致，hover 卡片属遗漏。

**数据可达性**：`hourly` 来自网络响应解析，但缓存可经备份导入持久化——`importData` 对 settings 只做浅合并（[storage.js L644](file:///Users/wyn/Dev/浏览器导航页/src/scripts/storage.js#L644)），不校验 `weatherCache` 内部结构；[weather.js L363-364](file:///Users/wyn/Dev/浏览器导航页/src/scripts/weather.js#L363) 启动时原样恢复。PoC 已实测：构造 `cache.hourly[0].icon = '<img src="https://attacker/pixel">'` 后，`renderHoverCard()` 输出包含未转义标签（idx=0 时 showIcon 恒真）。

**可达性限制（降级定级时已考虑）**：正常导入流程末尾 `refreshAllAfterDataChange` 会调 `Weather.setCity()`（[settings.js L819](file:///Users/wyn/Dev/浏览器导航页/src/scripts/settings.js#L819)），setCity 先 `cache=null` 再网络刷新，恶意缓存在毫秒级窗口后被清除。残留条件：导入后半段（setCity 之前的任一渲染）抛错中断，或文件/预览模式离线打开。因此定 P2 而非 P1。扩展模式 CSP 仍拦截脚本执行，外发图片/视觉欺骗不受限。

**修复建议**：hover 卡片对 `h.icon/h.temp/h.hour/rain` 与主 render 同一套 `escapeHtml`；在 ADV-03 的缓存恢复校验处同时校验 hourly 元素类型（icon/temp 必须是字符串/数字）。

---

### ADV-03 天气缓存 CACHE_VERSION 只写不读

**位置**：[weather.js L163](file:///Users/wyn/Dev/浏览器导航页/src/scripts/weather.js#L163) 定义 `CACHE_VERSION = 7`，L256、L534 写入缓存；[L363-364](file:///Users/wyn/Dev/浏览器导航页/src/scripts/weather.js#L363) 恢复缓存时只判 truthy：

```js
if (settings.weatherCache) {
  this.cache = settings.weatherCache;
  this.render();
}
```

全文件不存在任何 `version` 比较（已用 grep 证实：3 处出现 = 1 定义 + 2 写入，0 读取）。

**后果**：缓存结构演进（CACHE_VERSION 从 1 改到 7 说明已演进多次）后，旧版本写入的缓存仍被新代码读取。旧结构缺 `hourly[].rain` 时，hover 卡片 `Math.max(6, undefined)` → NaN，产出 `opacity:NaN`、`height:NaN%`；离线启动且主备源均失败时，损坏界面持续存在。这也放大 ADV-02：异常结构缓存没有任何入口拦截。

**修复建议**：恢复时校验 `cache.version === CACHE_VERSION` 且关键字段（temp/icon/hourly 数组）形状合法，不符则丢弃缓存并走 refresh；缓存结构变更时该闸口自动生效。

---

### ADV-04 快速切换城市的响应乱序竞态（PoC 实测）

**位置**：[weather.js setCity L485-493](file:///Users/wyn/Dev/浏览器导航页/src/scripts/weather.js#L485) → [refresh L582-599](file:///Users/wyn/Dev/浏览器导航页/src/scripts/weather.js#L582)，成功后 L594 无条件 `this.cache = data` 并持久化。没有任何请求代次（generation/requestId）检查。对照：wallpaper.js 已有成熟的 `_applyGen` 代次模式（P3-6 修复），天气模块未同步该模式。

**PoC**：mock fetch 令 A 城响应 120ms、B 城 30ms；不 await A 即调 setCity('B')。实测输出：

```
selectedCityQuery = B （界面城市名以此渲染）
cache.temp        = 11（A 城造的数据；B 城为 22）
[证实] 后选的 B 城被先返回的 A 城数据覆盖：城市标签=B、数据=A，且错误缓存已持久化
```

**机制**：`fetchWeather` 的 URL 在调用时按 `this.selectedCityQuery` 绑定，两条 fetch 链并发；先回的 B 先渲染，后回的 A 在 L594 无守卫覆盖，界面与 `weatherCache` 最终都停在 A。城市标签走 `getDisplayCity()`（读当前 selectedCityQuery=B），数据却是 A 的——错温错雨且用户无感知。弱网下（主源 5s 超时窗口内连点）极易触发。

**测试盲区**：`tests/unit/weather.test.js` 无 setCity/乱序用例（唯一含 "stale" 的用例测的是失败保留旧缓存的降级语义，与此无关）；E2E 只对壁纸做了乱序断言（[25] P3-6）。

**修复建议**：照抄 wallpaper 的代次模式——setCity/refresh 入口 `const gen = ++this._reqGen`，fetch 返回后 `if (gen !== this._reqGen) return`（主源失败回调、备源结果、L594 赋值三处都要判）。补乱序单测：慢请求后回不得覆盖新城市。

---

### ADV-05 随机壁纸不做明度采样，auto 主题对该源永远按 dark

**位置**：[wallpaper.js apply() L262-266](file:///Users/wyn/Dev/浏览器导航页/src/scripts/wallpaper.js#L262)：random 分支 `setBgImage` 后直接 return，不调用带 URL 的主题联动；Bing 分支在 [L302](file:///Users/wyn/Dev/浏览器导航页/src/scripts/wallpaper.js#L302) 有 `this.syncThemeFromWallpaper(url)`；`refreshCurrent()` 的 random 分支 L343-347 同样漏。全文件仅两处 `syncThemeFromWallpaper` 调用，带 URL 的只有 Bing 一处（grep 实测）。

**后果**：`theme='auto'（跟随壁纸）+ 随机壁纸源` 时 `themeHint` 恒为 null，[L208 `setWallpaperTone(null)`](file:///Users/wyn/Dev/浏览器导航页/src/scripts/wallpaper.js#L208) 落 dark 保底层——明色随机图上白字不可读。这直接违背 UX-13（auto 主题依据壁纸明度）的设计承诺：承诺覆盖两个在线源，实现只覆盖 Bing。

**修复约束（重要）**：`bing.biturl.top` **不在** manifest host_permissions（已核实，权限仅 cn.bing.com、wttr.in、api.open-meteo.com、ipwho.is、cdn.jsdelivr.net、raw.githubusercontent.com 6 条）。`syncThemeFromWallpaper` 用 `fetch` 取图采样，无 host 权限时跨域响应不透明，采样必失败——所以修复不能只补一行调用，需三选一：① 增加 biturl.top host_permissions 并同步更新隐私页（顺便修 ADV-07）；② 改用 `<img crossOrigin="anonymous">` + canvas 采样（依赖对方 CORS 头，需实测）；③ 产品上对随机源禁用 auto/显式标注"该源不支持跟随壁纸"。

**检测盲区**：`tools/ux-audit.js` L331 对比度矩阵只枚举 4 张**预设**壁纸（深邃星空/极光绿/落日暖阳/晨雾白），不含 Bing/随机两个在线源，故该缺陷体检永远测不到。建议矩阵补两个在线源的固定样图（mock fetch 返回本地夹具图）。

---

### ADV-06 chrome.storage 封装不处理 runtime.lastError + 测试替身语义失真

**位置**：[storage.js L305-318 storageGet / L320-327 storageSet](file:///Users/wyn/Dev/浏览器导航页/src/scripts/storage.js#L305)：

```js
return new Promise(resolve => chrome.storage.local.get(keys, resolve));
return new Promise(resolve => chrome.storage.local.set(data, resolve));
```

全文件无 `runtime.lastError`（grep 实测）。对照：settings.js L616、L776 的 chrome API 调用都检查了 `chrome.runtime.lastError`——项目知道该模式，storage 封装是遗漏。

**生产语义下的实际行为**：Chrome 存储出错时回调照常被调用、参数为空、`lastError` 已置位。于是：
1. Promise 永远 resolve（空值）而**永不 reject**——storage.js 中所有 `try/catch`（getBookmarks/getTodos/importData 回滚 L658-661）在 chrome 分支全部不可达；
2. 调用方拿到 undefined：`Storage.init` L333 `result.settings` 直接 TypeError（首页初始化中断、静态骨架），且 lastError 这个真正根因不会出现在日志里；
3. 导入"写入失败自动回滚"的承诺（L660）在真实扩展后端上从未被执行过。

**测试侧的虚假信心（命中 AGENTS.md「验证有效性」）**：[storage.test.js L22](file:///Users/wyn/Dev/浏览器导航页/tests/unit/storage.test.js#L22) 的 chrome mock 用**同步 throw**模拟 get 失败，且 set 根本没有失败注入；回滚测试只在 localStorage 分支（setItem 同步 throw，L47）生效。同步 throw 会被 Promise 构造器捕获成 reject——测试全绿，但真实 Chrome 是"回调 + lastError、不抛异常"，两条错误模型不同。结果：核心安全网（导入回滚）在生产后端零验证，测试绿灯还反向鼓励了现在的封装写法。

**修复建议**：
```js
return new Promise((resolve, reject) => chrome.storage.local.get(keys, (r) => {
  const e = chrome.runtime && chrome.runtime.lastError;
  e ? reject(new Error(e.message)) : resolve(r);
}));
```
同步把 mock 改成"调用回调 + 设置 lastError"的真实语义（set 失败注入也要补），回滚用例在 chrome 分支重跑一遍。

---

## 3. P3 清单（修复建议从简）

- **ADV-07 隐私页域名计数失真**：[settings.js L133](file:///Users/wyn/Dev/浏览器导航页/src/scripts/settings.js#L133) 写死"4 个域名"，manifest host_permissions 实为 6 条。下方"外部数据源"列表本身完整（含 favicon.im、biturl.top 两个无权限仅图加载的服务），故定 P3；但权限清单是用户核对浏览器授权的直接依据，属 P2-6 同类文案回归，修复时改为动态计数或与列表同源生成。
- **ADV-08 init 预设覆盖**：[storage.js L333-339](file:///Users/wyn/Dev/浏览器导航页/src/scripts/storage.js#L333)，settings 键缺失即写入预设书签/分类/空待办，无自动备份。1.0.0 起 settings 即带 version，正常升级不可达；单键损坏/手动清理时静默不可逆。建议覆盖前先走 `backupBeforeImport()` 同款备份。
- **ADV-09 getTodos 读失败显空态**：[storage.js L514-522](file:///Users/wyn/Dev/浏览器导航页/src/scripts/storage.js#L514)，与 getBookmarks 的注释口径不一致。注意：**数据覆盖不成立**（见 §4），问题仅是空态误导，建议失败时保留上次渲染或显式错误态。
- **ADV-10 搜索框 scheme 全放行**：[main.js L11/L46](file:///Users/wyn/Dev/浏览器导航页/src/scripts/main.js#L11)，`file:///`、`chrome://` 等输入即直跳；书签录入有协议白名单，两处口径建议统一（搜索框至少拦截 `file:`，`chrome://` 由浏览器兜底）。
- **ADV-11 defaultVisible 死字段**：COMPONENTS 注册表 7 处 `defaultVisible: true`、0 处读取（grep 实测）。删除或接入"恢复默认布局"。
- **ADV-12 隐藏天气组件仍发请求**：[settings.js L819](file:///Users/wyn/Dev/浏览器导航页/src/scripts/settings.js#L819) 无条件 `Weather.setCity(...)`；setCity（L485）/refresh（L582）均无 `_active` 守卫（refresh 自身其他路径已有 `_active` 使用先例）。用户隐藏组件表达的是"不联网"，导入备份不应逆转该选择；建议先判组件可见性，仅在可见时 setCity。
- **ADV-13 导入 settings 无白名单**：[storage.js L644](file:///Users/wyn/Dev/浏览器导航页/src/scripts/storage.js#L644) 浅合并接受任意键。当前无危险消费者：weatherCity 拼 URL 经推演无法逃逸 wttr.in host（路径中 `@`/`//` 不改变 authority），畸形字符仅导致请求失败；纵深上仍建议显式取键。
- **ADV-14 节假日兜底表过期**：[calendar.js L4-44](file:///Users/wyn/Dev/浏览器导航页/src/scripts/calendar.js#L4) 最晚 2026-10-10；今天 2026-10-17，双源全失败时 2027 年无节假日标注。年度运维债，建议纳入发布检查单或扩成多年表。
- **ADV-15 todo 字段类型**：[storage.js L207-224](file:///Users/wyn/Dev/浏览器导航页/src/scripts/storage.js#L207) 只查 id/text；`createdAt` 缺失时 [todos.js L13](file:///Users/wyn/Dev/浏览器导航页/src/scripts/todos.js#L13) 排序出 NaN（不崩、顺序不定）。历史 A14 遗留，补 `Number.isFinite(createdAt)` 校验即可。
- **ADV-16 Esc 关面板无守卫**：[settings.js L71-77](file:///Users/wyn/Dev/浏览器导航页/src/scripts/settings.js#L71)，面板内输入框按 Esc（惯用于清空/取消输入）会关掉整个面板。建议判断面板打开态且事件 target 非输入元素。
- **ADV-17 回滚脏值**：[storage.js L660](file:///Users/wyn/Dev/浏览器导航页/src/scripts/storage.js#L660) `storageSet(current)`，localStorage 分支对值为 undefined 的键执行 `setItem(k, JSON.stringify(undefined))` 写入字符串 `"undefined"`（L648 的注释只防护了备份轮转处）。触发需三条件叠加：回退后端 + 写入失败 + 键本就缺失，概率低；建议回滚前过滤 undefined 键。
- **ADV-18 城市下拉未转义**：[settings.js L598、L921](file:///Users/wyn/Dev/浏览器导航页/src/scripts/settings.js#L598) `${p.name}`/`${c.query}`/`${c.name}` 直插 option，同文件 L887 壁纸下拉已用 `escapeAttr` 对照。数据源为打包内静态 cities.json，当前不可利用，属纵深防御缺口，统一改用 escapeAttr/escapeHtml。

---

## 4. 已排除 / 自我证伪的假设（不列入缺陷）

1. **【自我证伪，原候选 P2】getTodos 失败 → 新增待办覆盖旧数据**。初判：getTodos catch 返回 []，用户新增会把空数组写回。核实后链断在写入端：[addTodo L525](file:///Users/wyn/Dev/浏览器导航页/src/scripts/storage.js#L525) 与 toggleTodo L538 **各自独立重新 storageGet**（不复用 getTodos 的 []），且无 try/catch——读取失败直接抛错、不执行 storageSet；localStorage 分支 parse 失败被吞为 undefined 后行为相同。故不构成数据丢失，仅保留为 ADV-09 的空态误导。
2. **天气 hover 主区 XSS**：主 render 的 icon/temp/desc 全部经 escapeHtml，码表映射不直接落外部字符串；历史 A9 修复有效。
3. **weatherCity 跨主机注入**：路径段无法改变 URL authority（`@`、`//`、`?#` 均在路径/查询内），最坏结果是请求畸形，已降为 ADV-13 的一部分。
4. **数字键误触"添加磁贴"**：openBookmarkByIndex 对无 href 目标有 `!target.href` 守卫。
5. **拖拽 reorder 与 DOM 移动语义不一致**：对 [a,b,c,d] from=0/to=2 等多组样例推演，splice 两路径一致。
6. **日历 rerenderCard 丢监听**：事件委托绑在被保留的 card 容器，innerHTML 替换内容不影响。
7. **wallpaperName 无效值 apply(undefined)**：init 仅在 idx !== -1 时更新 currentIndex。
8. **pack.js zip slip**：条目名只来自 src/ 目录遍历，无外部输入。
9. **CSP 缺口**：connect-src/img-src 白名单与实际外连一致；object-src/worker-src 走 default-src 'self'；无 web_accessible_resources、无 content_scripts。img-src 为 `https:` 通配属 favicon 功能的已知权衡（历史已记录），但它使 ADV-02 的外发图片成为可能，修复时勿再放宽。
10. **E2E [12] 网络审计白名单是内联副本**：核实为 `require('../../src/scripts/network-audit.js')` 直接共享源码，无漂移。

---

## 5. 对测试有效性的评价

本轮 6 个 P2 中有 3 个同时暴露了测试体系问题，且均属本项目反复出现的"绿灯失真"类型：

1. **ADV-06 的替身语义错误**（最严重）：chrome mock 用同步 throw 表达失败，真实后端用 lastError 回调；导入回滚只在 localStorage 分支验证，生产用的 chrome 分支从未验证。建议按 §2 ADV-06 修复并重跑回滚用例。
2. **ADV-01 的对抗用例缺失**：validateBackup 现有用例全是"单个恶意输入"，没有错误计数、位置、跨类别截断的对抗构造。
3. **ADV-04/05 的覆盖矩阵缺口**：天气无乱序用例（壁纸有，[25]）；ux-audit 对比度矩阵只含预设壁纸，两个在线源（auto 主题真正吃明度的地方）反而不在矩阵内。
4. **ADV-02/03 无缓存结构契约测试**：E2E 对 hover 卡片只断言列数、时间文案、监听器数量（[13]/whc 相关断言），没有"恶意/旧版缓存内容"的渲染断言。

正面确认：E2E 网络审计白名单共享源码（无副本漂移）、shim 宏任务时序、天气双源链路 [26]/[27]、壁纸乱序 [25] 等既有设施有效，本轮结论不涉及这些区域。

---

## 6. 建议修复顺序

1. **ADV-01**（改动最小、安全闸确定性绕过：循环 break 改继续 + 1 条对抗单测）。
2. **ADV-06 + mock 语义修正**（其他错误处理结论的地基，修完才能可信地验证回滚）。
3. **ADV-04**（照抄已有 `_applyGen` 模式 + 乱序单测，低风险机械修改）。
4. **ADV-03 + ADV-02 同批修**（缓存恢复校验 + hover 转义，互为表里，共用一个"缓存形状"夹具测试）。
5. **ADV-05**（需先做产品/权限决策：加 host 权限还是随机源降级 auto；决策后联动改隐私页 ADV-07 与 ux-audit 矩阵）。
6. P3 随相邻改动顺手清理；ADV-14 纳入年度发布检查单。

**验证要求提醒**：每项修复按 AGENTS.md 规则补"回退被测代码即红灯"的断言；天气类改动跑 E2E [26]/[27]/[44]；主题/壁纸改动跑 `node tools/ux-audit.js --contrast` 并扩展在线源矩阵。

---

## 7. 修复状态（2026-10-17）

本轮 P2 共 6 项，已全部修复并完成区分性验证，版本 1.1.2：

| 编号 | 状态 | 验证 |
|---|---|---|
| ADV-01 校验器错误上限截断 | ✅ 已修复 | 校验遍历全部条目，8 条上限只用于展示。新增「8 诱饵 + 第 9 条恶意」与跨类别两条单测；回退 storage.js 后均红灯 |
| ADV-02 悬停卡片未转义 | ✅ 已修复 | 与主 render 同一套 escapeHtml，降水值收敛到 0–100，非法时间戳不再产出 NaN:NaN。新增注入用例，回退后红灯 |
| ADV-03 CACHE_VERSION 只写不读 | ✅ 已修复 | 新增 `isValidWeatherCache`，init 恢复前校验版本与字段形状。新增旧版本/畸形缓存用例，回退后红灯 |
| ADV-04 切城市响应乱序 | ✅ 已修复 | 沿用壁纸的 `_applyGen` 代次模式：setCity 入口开启 `_reqGen`，refresh 走 `_refreshWithGen`。新增「慢深圳 / 快北京」乱序用例，回退后红灯 |
| ADV-05 随机壁纸明度采样 | ✅ 已修复 | 改用 `<img crossOrigin="anonymous">` + canvas（Canvas 只认服务端 CORS 头，不认扩展 host_permissions），fetch 保留为有权限域的回退通道。实测随机源 307 后 `www.bing.com/th` 与 `cn.bing.com/th` 均返回 ACAO: *；E2E [39] 新增随机亮图断言，回退 wallpaper.js 后红灯。未新增任何 host 权限 |
| ADV-06 lastError 未处理 | ✅ 已修复 | storageGet/Set 在回调内检查 `chrome.runtime.lastError` 并 reject；单测 mock 改为「回调 + lastError」语义，新增 chrome 分支回滚用例，回退后红灯 |

**验证结果**：单测 79/79、preview E2E 129/129、shim E2E 132/132、E2E 全量四模式 392/392、体验体检 49 项通过 / 0 项不通过。

**P3 进展**：ADV-14 已修复——内置节假日兜底改由 lunar 1.7.7 的 `HolidayUtil` 生成，
删除与国务院公告不一致的手工 2026 表；2027 数据待公告后升级库。其余 ADV-07~18 未处理。
