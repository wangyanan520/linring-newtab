const Todos = {
  showForm: false,
  _saving: false,

  async init() {
    await this.render();
  },

  async render() {
    const container = document.getElementById('todoContent');
    if (!container) return;
    const todos = await Storage.getTodos();
    todos.sort((a, b) => a.createdAt - b.createdAt);

    const formHtml = this.showForm ? `
      <div class="todo-input-form">
        <div class="todo-input-wrapper">
          <input type="text" class="todo-input" id="todoInput" placeholder="添加待办事项..." maxlength="100">
          <button class="todo-submit-btn" id="todoSubmit">添加</button>
        </div>
        <div class="todo-save-feedback" id="todoFeedback"></div>
      </div>
    ` : '';

    const todoHtml = todos.length === 0
      ? '<div class="todo-empty">还没有待办事项</div>'
      : todos.map(t => `
        <div class="todo-item" data-id="${escapeAttr(t.id)}">
          <input type="checkbox" class="todo-checkbox" ${t.done ? 'checked' : ''}>
          <span class="todo-text ${t.done ? 'done' : ''}">${escapeHtml(t.text)}</span>
          <button class="todo-delete-btn">×</button>
        </div>
      `).join('');

    container.innerHTML = formHtml + `<div class="todo-list">${todoHtml}</div>`;

    if (this.showForm) {
      const input = document.getElementById('todoInput');
      const submit = document.getElementById('todoSubmit');
      if (input) {
        input.focus();
        input.addEventListener('keydown', async (e) => {
          // isCommitEnter：中文等输入法用 Enter 确认候选词时不应提交待办（P2-9，
          // UX-04 起与搜索框共用同一判定）
          if (isCommitEnter(e)) await this.add();
        });
        // blur 不再自动添加，仅通过 Enter 键或按钮提交
      }
      if (submit) {
        submit.addEventListener('click', async () => await this.add());
      }
    }

    container.querySelectorAll('.todo-checkbox').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const id = e.target.closest('.todo-item').dataset.id;
        await Storage.toggleTodo(id);
        await this.render();
      });
    });

    container.querySelectorAll('.todo-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.closest('.todo-item').dataset.id;
        // UX-08：× 一点即删且不可恢复，误删只能重打一遍。
        // 删除前先留存完整数据（含原 createdAt），撤销时按原样放回而不是当成新条目追加。
        const todos = await Storage.getTodos();
        const removed = todos.find(t => t.id === id);
        await Storage.deleteTodo(id);
        await this.render();
        if (removed && typeof Toast !== 'undefined') {
          const label = removed.text.length > 12 ? removed.text.slice(0, 12) + '…' : removed.text;
          Toast.show(`已删除「${label}」`, {
            actionLabel: '撤销',
            duration: 5000,
            onAction: async () => {
              await Storage.restoreTodo(removed);
              await this.render();
            }
          });
        }
      });
    });
  },

  async add() {
    if (this._saving) return;
    const input = document.getElementById('todoInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    this._saving = true;
    const submit = document.getElementById('todoSubmit');
    if (submit) submit.disabled = true;

    try {
      await Storage.addTodo(text);
      this.showForm = false;
      this._saving = false;
      await this.render();
    } catch (err) {
      console.error('保存待办失败:', err);
      this.showFeedback('保存失败，请重试', 'error');
      this._saving = false;
      if (submit) submit.disabled = false;
    }
  },

  showFeedback(msg, type) {
    const feedback = document.getElementById('todoFeedback');
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.className = 'todo-save-feedback ' + (type === 'error' ? 'feedback-error' : 'feedback-success');
    clearTimeout(this._feedbackTimer);
    this._feedbackTimer = setTimeout(() => {
      const fb = document.getElementById('todoFeedback');
      if (fb) {
        fb.textContent = '';
        fb.className = 'todo-save-feedback';
      }
    }, 3000);
  },

  toggleForm() {
    this.showForm = !this.showForm;
    this.render();
  },

  /* escapeHtml 定义在 storage.js */
};
