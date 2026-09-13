# 第三方组件

本扩展包含以下第三方组件。分发时请一并保留本文件及其许可证声明
（MIT 许可证要求版权声明与许可声明随软件副本一同提供）。

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
