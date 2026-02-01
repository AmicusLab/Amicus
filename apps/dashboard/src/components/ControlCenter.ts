import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isConnected } from '../state/signals.js';
import { getTasks, pauseTask, resumeTask, cancelTask, emergencyStop } from '../api/client.js';

interface TaskInfo {
  taskId: string;
  cronExpression?: string;
}

@customElement('control-center')
export class ControlCenter extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }
    .container {
      background: #1a1a1a;
      border-radius: 8px;
      border: 1px solid #333;
      padding: 1rem;
    }
    .header {
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 0.5rem;
    }
    .connected { background: #4ade80; }
    .disconnected { background: #ef4444; }
    .task-list {
      margin-top: 1rem;
    }
    .task-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: #222;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    .task-id {
      font-family: monospace;
      font-size: 0.875rem;
    }
    .btn {
      padding: 0.25rem 0.75rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.75rem;
      margin-left: 0.5rem;
    }
    .btn-pause { background: #fbbf24; color: #000; }
    .btn-resume { background: #4ade80; color: #000; }
    .btn-cancel { background: #ef4444; color: #fff; }
    .btn-refresh { background: #3b82f6; color: #fff; }
    .empty {
      color: #666;
      text-align: center;
      padding: 1rem;
    }
    .kill-switch {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #333;
    }
    .btn-kill {
      width: 100%;
      padding: 0.75rem;
      background: #dc2626;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-kill:hover {
      background: #b91c1c;
    }
  `;

  @state() private _tasks: TaskInfo[] = [];
  @state() private _runningIds: string[] = [];

  connectedCallback() {
    super.connectedCallback();
    this._loadTasks();
  }

  private async _loadTasks() {
    try {
      const res = await getTasks();
      if (res.success && res.data) {
        this._tasks = res.data.scheduled;
        this._runningIds = res.data.running;
      }
    } catch (e) {
      console.error('Failed to load tasks:', e);
    }
  }

  private async _handlePause(taskId: string) {
    await pauseTask(taskId);
    this._loadTasks();
  }

  private async _handleResume(taskId: string) {
    await resumeTask(taskId);
    this._loadTasks();
  }

  private async _handleCancel(taskId: string) {
    await cancelTask(taskId);
    this._loadTasks();
  }

  private async _handleEmergencyStop() {
    try {
      const result = await emergencyStop();
      if (result.success && result.data) {
        const { cancelledCount, cancelledIds } = result.data;
        alert(`Emergency stop executed. Cancelled ${cancelledCount} task(s): ${cancelledIds.join(', ') || 'none'}`);
        this._loadTasks();
      } else {
        alert('Emergency stop failed');
      }
    } catch (e) {
      console.error('Emergency stop failed:', e);
      alert('Emergency stop failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }

  render() {
    const connected = isConnected.value;
    
    return html`
      <div class="container">
        <div class="header">
          <span>Control Center</span>
          <span>
            <span class="status-indicator ${connected ? 'connected' : 'disconnected'}"></span>
            ${connected ? 'Connected' : 'Disconnected'}
            <button class="btn btn-refresh" @click=${this._loadTasks}>Refresh</button>
          </span>
        </div>
        
        <div class="task-list">
          <strong>Tasks (${this._tasks.length} scheduled, ${this._runningIds.length} running)</strong>
          ${this._tasks.length === 0 && this._runningIds.length === 0
            ? html`<div class="empty">No tasks</div>`
            : html`
                ${this._tasks.map(t => html`
                  <div class="task-item">
                    <span class="task-id">${t.taskId}</span>
                    <div>
                      <button class="btn btn-pause" @click=${() => this._handlePause(t.taskId)}>Pause</button>
                      <button class="btn btn-resume" @click=${() => this._handleResume(t.taskId)}>Resume</button>
                      <button class="btn btn-cancel" @click=${() => this._handleCancel(t.taskId)}>Cancel</button>
                    </div>
                  </div>
                `)}
                ${this._runningIds.map(id => html`
                  <div class="task-item">
                    <span class="task-id">${id} (running)</span>
                    <div>
                      <button class="btn btn-pause" @click=${() => this._handlePause(id)}>Pause</button>
                      <button class="btn btn-cancel" @click=${() => this._handleCancel(id)}>Cancel</button>
                    </div>
                  </div>
                `)}
              `}
        </div>
        
        <div class="kill-switch">
          <button class="btn-kill" @click=${this._handleEmergencyStop}>
            EMERGENCY STOP
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'control-center': ControlCenter;
  }
}
