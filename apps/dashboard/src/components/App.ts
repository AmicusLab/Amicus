import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import './StatusBoard.js';
import './ThoughtStream.js';
import './ControlCenter.js';

@customElement('amicus-app')
export class AmicusApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }
    .header {
      padding: 1rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid #333;
    }
    .header h1 {
      font-size: 1.5rem;
      font-weight: 600;
    }
    .header p {
      color: #888;
      font-size: 0.875rem;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 768px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    return html`
      <div class="header">
        <h1>Amicus Dashboard</h1>
        <p>Local-First AI Assistant Control Panel</p>
      </div>
      
      <status-board></status-board>
      
      <div class="grid">
        <thought-stream></thought-stream>
        <control-center></control-center>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'amicus-app': AmicusApp;
  }
}
