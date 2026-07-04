# Design

## Theme

暗色主题。这是一个每天在浏览器中打开数十次的工具页面，暗色减少视觉疲劳，同时传递沉稳、专业的气质。

场景描述：企业办公室或居家办公环境，上午或夜间，用户在浏览器中打开新标签页 —— 需要一个安静、克制的起始页，不打扰思考，但传递品牌存在感。

## Color Strategy

色彩策略：**Restrained（克制型）**—— 底色纯净，品牌色在中性表面中自然浮现。主品牌色（靛蓝灰）用于标题和关键强调，accent 提供细微的交互反馈。不发散、不喧哗。

### Palette

```css
/* Dark theme */
--bg:         oklch(0.06 0.000 0)        /* 近纯黑，chroma 0 */
--surface:    oklch(0.10 0.010 270)      /* 极浅冷灰表面，微蓝 tint */
--surface-2:  oklch(0.14 0.012 270)      /* 深一度表面，用于 hover */
--ink:        oklch(0.92 0.008 270)      /* 主文字色，冷灰白 */
--muted:      oklch(0.50 0.020 270)      /* 次要文字 */
--primary:    oklch(0.60 0.040 260)      /* 品牌色 — 钢蓝灰，克制专业 */
--accent:     oklch(0.55 0.070 290)      /* 强调色 — 淡紫灰，用于交互反馈 */
```

**为什么是这个 palette：**

- 底色 `#080812` → `oklch(0.06 0 0)` — 纯黑，chroma 0。不给底色加"科技感"色调，品牌色通过 primary 传达
- primary 钢蓝灰（L 0.60, C 0.04, H 260）— 接近深的铁灰色带微蓝。不抢眼，但有存在感。符合"低调沉稳"
- accent 淡紫灰（L 0.55, C 0.07, H 290）— 仅比 primary 多一点 chroma 和不同的 hue，hover/focus 时可见，平常几乎察觉不到

### 反回避清单

- ❌ 不使用 AI 默认的紫色 `oklch(0.60 0.18 310)` 作为 accent
- ❌ 不使用蓝紫渐变作为背景
- ❌ 不使用 warm cream / beige 底色
- ❌ 不添加暖色调到文字或表面中（凌睿科技是技术公司，冷色更合适）

## Typography

```
Display:  "Noto Sans SC" 200/300 weight
Body:     -apple-system, "PingFang SC" (系统字体)

Scale:
  Brand heading:  28px / 300 / 8px letter-spacing
  Time display:   72px / 200 / 4px letter-spacing
  Body:           15px / 350
  UI / Caption:   11-12px / 400
  Small:          10-11px / 400
```

只使用一套 Noto Sans SC（Google Fonts，一个请求覆盖所有字重）。不堆叠两种以上字体。

## Layout

```
Masthead:       品牌左 / 日期天气右
Main content:
  ├─ Brand heading (h1)
  ├─ Time display (72px)
  ├─ Greeting
  ├─ Search box (580px)
  ├─ Bookmarks (居中行)
  └─ Content grid:
       ├─ Categories (左，flex column)
       └─ Todo sidebar (右，220px 固定)
Footer:         壁纸 | 设置（居中）
```

内容区 max-width: 820px。布局是"精确居中 + 底部侧栏打破对称"——不是单调的全居中，也不是不对称到令人不安。

## Components

### Cards
- radius: 14px 统一（所有容器卡）
- background: var(--surface)
- border: 1px solid var(--surface-border)（~3% 白）
- border-radius 无例外

### Buttons / Interactive
- radius: 9999px（pill 形状）
- background hover: var(--surface-hover)
- transition: 0.25s cubic-bezier(0.22, 1, 0.36, 1)

### Search
- radius: 9999px
- focus: 1px border light-up，无 glow 扩散
- height: ~48px

## Motion

- MOTION_INTENSITY: low（2/10）
- 仅有的动效：hover 微弱上移（-2px）、背景壁纸 1.2s 渐变过渡、聚焦态 border 过渡
- 无 scroll-triggered、无 stagger、无 parallax
- 所有动效应尊重 `prefers-reduced-motion`

## Design Tokens Summary

```css
:root {
  --bg-base:           #080812;
  --text-primary:      #e6e6ec;
  --text-secondary:    rgba(230, 230, 236, 0.55);
  --text-tertiary:     rgba(230, 230, 236, 0.28);
  --surface-bg:        rgba(255, 255, 255, 0.03);
  --surface-hover:     rgba(255, 255, 255, 0.06);
  --surface-border:    rgba(255, 255, 255, 0.05);
  --accent:            #818cf8;
  --radius-container:  14px;
  --radius-interactive: 9999px;
  --ease-out:          cubic-bezier(0.22, 1, 0.36, 1);
  --font-display:      "Noto Sans SC", "PingFang SC", system-ui;
  --font-body:         -apple-system, "PingFang SC", system-ui;
}
```
