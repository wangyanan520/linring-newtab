/**
 * 轻量操作反馈（Toast）
 *
 * 为什么需要它：两处交互此前是"静默生效"的——
 * - 待办 × 一点即删，没有确认也没有撤销，误删无法找回（UX-08）
 * - 壁纸按钮切换后只有背景变化，用户不确定切到了哪张、还有没有下一张（UX-11）
 *
 * 为什么删除不做 confirm()：确认弹窗打断性强，而且它只防"手滑"，不防"删完后悔"。
 * 可撤销提示两者兼顾，且不阻塞操作流。
 *
 * 无障碍：容器带 role="status" + aria-live="polite"（见 index.html），
 * 读屏会在不打断当前朗读的前提下播报出来。
 */
const Toast = {
  _timer: null,

  /**
   * @param {string} message 提示文案
   * @param {{actionLabel?: string, onAction?: Function, duration?: number}} [opts]
   * @returns {HTMLElement|null} 生成的 toast 元素（便于测试断言）
   */
  show(message, opts = {}) {
    const { actionLabel, onAction, duration = 3000 } = opts;
    const root = document.getElementById('toastRoot');
    if (!root) return null;

    clearTimeout(this._timer);
    root.innerHTML = '';

    const item = document.createElement('div');
    item.className = 'toast';

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    item.appendChild(text);

    if (actionLabel && typeof onAction === 'function') {
      const btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.type = 'button';
      btn.textContent = actionLabel;
      btn.addEventListener('click', async () => {
        this.hide();
        await onAction();
      });
      item.appendChild(btn);
    }

    root.appendChild(item);
    root.classList.add('visible');
    // 先插入再加动画类，让 transition 有起始状态可过渡（否则会直接闪现）
    requestAnimationFrame(() => item.classList.add('in'));

    this._timer = setTimeout(() => this.hide(), duration);
    return item;
  },

  hide() {
    clearTimeout(this._timer);
    const root = document.getElementById('toastRoot');
    if (!root) return;
    root.classList.remove('visible');
    root.innerHTML = '';
  },

  /** 当前是否正在展示（测试与调用方判断用） */
  isVisible() {
    const root = document.getElementById('toastRoot');
    return !!(root && root.classList.contains('visible') && root.firstChild);
  }
};

/* Node 测试环境导出：顶层无浏览器副作用，require 安全 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Toast };
}
