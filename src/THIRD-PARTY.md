# 第三方组件

本扩展包含以下第三方组件。分发时请一并保留本文件及其许可证声明
（MIT 许可证要求版权声明与许可声明随软件副本一同提供）。

---

## 运行时数据服务（不打包进扩展，运行时按需请求）

这些服务没有代码进入分发包，但运行时会按其条款请求，故一并记录。
**完整清单以 `scripts/network-audit.js` 的 `NETWORK_ALLOWLIST` 为准**（该文件随包分发），
用户可见的说明见设置面板「隐私」页。

**条目组织方式**：先给一张总表覆盖全部数据源；只有**条款对分发或商业化构成实际约束**
的服务才另开小节展开（Open-Meteo 的 CC-BY 署名与非商业限制、ipwho.is 的免费计划限制）。
其余服务的条款未展开，不代表没有条款 —— 请以各自主页的最新文本为准，不要按"没展开＝无约束"理解。

### 数据源总表

| 域名 | 用途 | 触发时机 | 许可 / 条款 |
|------|------|---------|------------|
| `wttr.in` | 天气主源 | 天气组件刷新（30 分钟） | 项目代码 Apache-2.0（本扩展只调用其公开接口，未包含其代码）；接口为免费公共服务 |
| `api.open-meteo.com` | 天气备用源 | 主源请求失败后回退 | 数据 CC-BY 4.0（要求署名）；免费层限非商业 ← 详见下节 |
| `ipwho.is` | IP 定位兜底 | 未选城市且浏览器定位不可用时 | 免费计划（个人/组织内部用途） ← 详见下节 |
| `cn.bing.com` | Bing 每日壁纸 | 壁纸源为「Bing 每日」且当日无缓存 | Microsoft 服务条款；使用的是其公开的壁纸接口 |
| `bing.biturl.top` | 随机壁纸 | 壁纸源为「随机壁纸」 | 第三方服务，未查到公开的专门条款 |
| `cdn.jsdelivr.net` | 节假日数据主源（holiday-cn） | 日历初始化且缓存过期 | jsDelivr 服务条款；所取内容为开源数据集 |
| `raw.githubusercontent.com` | 节假日数据备源 | 主源失败 | GitHub 服务条款；所取内容为开源数据集 |
| `*.favicon.im` | 书签图标 | 书签渲染 | 第三方服务，未查到公开的专门条款 |
| 书签自身域名 | favicon 兜底直连 | favicon.im 失败时 | 目标站点自身，无第三方介入；已在设置面板「隐私」页披露 |

### Open-Meteo（天气备用源）

| 项 | 内容 |
|----|------|
| 用途 | `api.open-meteo.com` — 主源 wttr.in 请求失败时的天气回退（`scripts/weather.js`） |
| 来源 | https://open-meteo.com/ |
| 许可证 | 数据按 **CC-BY 4.0** 提供，**要求署名** |
| 免费额度 | 非商业用途；每日 &lt; 10000 次、每小时 &lt; 5000 次、每分钟 &lt; 600 次 |
| 本扩展用量 | 天气刷新间隔 30 分钟且仅在主源失败时请求，单设备每日上限约 48 次，远低于额度 |

**分发/商用注意**：免费层**仅限非商业用途**（无订阅、无广告的私有或非营利应用）。
若本扩展被用于商业产品、或与广告/订阅捆绑分发，需改用其付费 API 计划。
依据：https://open-meteo.com/en/terms

### ipwho.is（IP 定位兜底）

| 项 | 内容 |
|----|------|
| 用途 | `ipwho.is` — 未选择城市且浏览器定位不可用时取城市级经纬度（`scripts/weather.js`） |
| 来源 | https://ipwhois.io/ |
| 许可 | 免费计划，允许个人或组织内部业务用途；无可用性 SLA |
| 本扩展用量 | 仅在未选择城市时于页面初始化阶段请求一次 |

依据：https://ipwhois.io/terms

---

## lunar-javascript

| 项 | 内容 |
|----|------|
| 用途 | 农历、节气、干支换算（`scripts/calendar.js` 通过 `Solar.fromYmd` 使用） |
| 来源 | https://github.com/6tail/lunar-javascript |
| 作者 | 6tail &lt;6tail@6tail.cn&gt; |
| 许可证 | MIT |
| 文件 | `scripts/lunar.min.js` |
| 体积 | 约 425 KB，占扩展总体积约 62% |

### 版本说明

入库时**未记录版本号**，压缩文件内也不含版本或许可证头。经 API 特征比对
（`Lunar` / `Solar` / `fromYmd` / `getJieQi` / `EightChar` 等）确认为 lunar-javascript；
比对时上游最新版本为 1.7.7。

**后续升级请在此处补记目标版本**，并重新确认 `calendar.js` 实际使用的 API
（当前仅 `Solar.fromYmd`）在新版本中仍然兼容——库与调用方之间没有版本锁，属于隐式契约。

### 已知优化空间

当前引入的是完整构建，而实际只用到 `Solar.fromYmd` 一个 API；库中的八字（`EightChar`）、
佛历/道历、彭祖百忌等能力均未使用。若需压缩体积，可考虑按需构建，或自行实现所需的最小
农历换算逻辑。

### 许可证全文

```
MIT License

Copyright (c) 2018 6tail

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
