# 凌睿科技导航页 — 开发计划文档

## 1. 开发阶段总览

```
阶段 1: 项目初始化 ──────────────────────── 0.5h
阶段 2: 核心骨架 ─── manifest + HTML + CSS ─ 2.5h
阶段 3: 数据层 ───── storage 封装 + 预设数据 ─ 2h
阶段 4: 功能开发 ─── 搜索 + 书签 + 分类 ──── 6h
阶段 5: 增强功能 ─── 时间 + 壁纸 + 设置面板 ─ 4h
阶段 6: 验证发布 ─── 测试 + 打包 + 文档整理 ─ 1.5h
────────────────────────────────────────
总计: ~16.5h
```

## 2. 详细开发任务

### 阶段 1：项目初始化（0.5h）
- 创建项目目录结构
- 收集壁纸图片资源（Unsplash 免费图片 6-8 张）
- 准备扩展图标（16/48/128）

### 阶段 2：核心骨架（2.5h）

#### 2.1 manifest.json（0.5h）
- 配置 Manifest V3 清单
- 设置 `chrome_url_overrides.newtab`
- 声明 `storage` 权限
- 配置基础信息（名称、版本、描述）

#### 2.2 index.html（1h）
- 构建完整 DOM 结构
- 语义化标签 + 模块划分
- 引入外部 CSS/JS

结构：
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>凌睿科技导航页</title>
  <link rel="stylesheet" href="styles/main.css">
  <link rel="stylesheet" href="styles/settings.css">
</head>
<body>
  <div class="container">
    <header class="top-bar">
      <div class="datetime"></div>
    </header>

    <main class="main-content">
      <h1 class="title">凌睿科技导航</h1>

      <div class="search-box">
        <input type="text" id="searchInput" placeholder="搜索..." autofocus>
        <button id="searchBtn">搜索</button>
        <div class="search-engine-select"></div>
      </div>

      <section class="quick-links">
        <h2>常用网站</h2>
        <div class="links-grid" id="bookmarkContainer"></div>
      </section>

      <section class="categories" id="categoryContainer"></section>
    </main>

    <footer class="bottom-bar">
      <button id="wallpaperBtn">切换壁纸</button>
      <button id="settingsBtn">设置</button>
    </footer>
  </div>

  <div class="settings-overlay" id="settingsOverlay">
    <div class="settings-panel">
      <!-- 设置面板内容 -->
    </div>
  </div>

  <script src="scripts/storage.js"></script>
  <script src="scripts/wallpaper.js"></script>
  <script src="scripts/settings.js"></script>
  <script src="scripts/main.js"></script>
</body>
</html>
```

#### 2.3 styles/main.css（1h）
- CSS 变量定义（主题色、字体、间距）
- 全屏背景样式
- Flexbox/Grid 布局
- 搜索框样式（居中、圆角、阴影）
- 快捷书签网格样式
- 分类导航卡片样式
- 底部工具栏样式
- 响应式断点适配
- 过渡动画效果

### 阶段 3：数据层（2h）

#### 3.1 scripts/storage.js（2h）
- 定义预设数据常量（书签、分类、设置）
- 实现 `initStorage()` 首次安装初始化
- 实现书签 CRUD 方法
- 实现分类 CRUD 方法
- 实现分类内链接 CRUD 方法
- 实现设置读写方法
- 使用 `chrome.storage.local` API

### 阶段 4：功能开发（6h）

#### 4.1 scripts/main.js（3h）
- `DOMContentLoaded` 初始化入口
- 调用 `storage.initStorage()` 初始化数据
- 渲染快捷书签列表
- 渲染分类导航列表
- 搜索框事件监听（回车搜索、清除）
- 搜索跳转逻辑
- 书签点击跳转逻辑
- 分类展开折叠逻辑

#### 4.2 scripts/settings.js（3h）
- 设置面板打开/关闭动画
- 快捷书签管理 Tab
  - 展示已有书签列表
  - 添加书签表单（名称+网址）
  - 编辑书签（双击或点击编辑按钮）
  - 删除书签（带确认）
- 分类导航管理 Tab
  - 展示已有分类列表
  - 添加分类（命名）
  - 分类内添加链接
  - 编辑/删除分类和链接
- 设置保存回调，刷新主页面

### 阶段 5：增强功能（4h）

#### 5.1 时间显示（0.5h）
- `main.js` 中实现时钟更新
- 每秒更新时间
- 格式化日期（年月日 星期）

#### 5.2 壁纸管理（1.5h）
- `scripts/wallpaper.js` 实现
- 壁纸列表定义
- 切换壁纸（随机/指定）
- 壁纸设置持久化
- 切换按钮绑定

#### 5.3 设置面板样式（0.5h）
- `styles/settings.css` 实现
- 模态弹窗样式
- 表单样式
- Tab 切换样式
- 深色背景遮罩

#### 5.4 细节优化（1.5h）
- 加载过渡动画
- 书签图标加载失败兜底
- 空状态展示
- 操作反馈（保存成功提示）
- 键盘快捷键（ESC 关闭设置）

### 阶段 6：验证与发布（1.5h）

#### 6.1 功能测试
- 新标签页覆盖测试
- 搜索功能测试
- 书签增删改查测试
- 分类增删改查测试
- 壁纸切换测试
- 数据持久化测试

#### 6.2 兼容性测试
- 不同分辨率显示测试
- Chrome 88+ 版本兼容性

#### 6.3 打包发布
- 生成 `.zip` 包
- 开发者模式加载测试

## 3. 开发顺序依赖图

```
manifest.json ─┐
               ├──→ index.html ──→ main.css ──→ main.js
storage.js ────┘                    │              │
                                    ↓              ↓
                              settings.css    settings.js
                                    │          wallpaper.js
                                    ↓              ↓
                              设置面板功能       壁纸功能
```

## 4. Git 提交策略

```
commit 1: 项目初始化 (目录结构 + manifest + 图标)
commit 2: 页面骨架 (HTML + 基础 CSS)
commit 3: 数据层 (storage.js + 预设数据)
commit 4: 核心功能 (搜索 + 书签 + 分类渲染)
commit 5: 设置面板 (书签/分类管理)
commit 6: 增强功能 (时间 + 壁纸)
commit 7: 样式打磨 + Bug 修复
commit 8: MVP 发布版
```

## 5. 开发环境

| 工具 | 用途 |
|------|------|
| VS Code | 代码编辑器 |
| Chrome 浏览器 | 运行和调试 |
| Chrome 开发者工具 | 调试扩展 |
| Chrome 扩展管理页 (chrome://extensions) | 加载已解压的扩展 |
