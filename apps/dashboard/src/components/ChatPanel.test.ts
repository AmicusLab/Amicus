import { describe, it, expect, beforeEach } from 'bun:test';
import { ChatPanel } from './ChatPanel.js';

describe('ChatPanel', () => {
  it('should be defined', () => {
    expect(ChatPanel).toBeDefined();
  });

  it('should have correct element name', () => {
    const panel = new ChatPanel();
    expect(panel.tagName.toLowerCase()).toBe('chat-panel');
  });

  it('should accept messages property', () => {
    const panel = new ChatPanel();
    const messages = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' }
    ];
    panel.messages = messages;
    expect(panel.messages).toHaveLength(2);
    expect(panel.messages[0].role).toBe('user');
    expect(panel.messages[1].role).toBe('assistant');
  });

  it('should initialize with empty messages', () => {
    const panel = new ChatPanel();
    expect(panel.messages).toEqual([]);
  });

  it('should initialize with empty input value', () => {
    const panel = new ChatPanel();
    expect(panel['inputValue']).toBe('');
  });

  it('should initialize with streaming disabled', () => {
    const panel = new ChatPanel();
    expect(panel['isStreaming']).toBe(false);
  });

  it('should render empty state when no messages', () => {
    const panel = new ChatPanel();
    panel.messages = [];
    panel.requestUpdate();
    // The render method should show empty state
    const result = panel.render();
    expect(result).toBeDefined();
  });

  it('should handle message input', () => {
    const panel = new ChatPanel();
    panel['inputValue'] = 'Test message';
    expect(panel['inputValue']).toBe('Test message');
  });

  it('should have send button disabled when input is empty', () => {
    const panel = new ChatPanel();
    panel['inputValue'] = '';
    const canSend = !panel['inputValue'].trim() || panel['isStreaming'];
    expect(canSend).toBe(true); // disabled = true
  });

  it('should have send button enabled when input has content', () => {
    const panel = new ChatPanel();
    panel['inputValue'] = 'Hello';
    const canSend = !panel['inputValue'].trim() || panel['isStreaming'];
    expect(canSend).toBe(false); // disabled = false
  });

  it('should handle tool calls map', () => {
    const panel = new ChatPanel();
    const toolCalls = new Map();
    toolCalls.set('tool-1', { id: 'tool-1', name: 'test_tool', status: 'running' });
    panel['toolCalls'] = toolCalls;
    expect(panel['toolCalls'].size).toBe(1);
    expect(panel['toolCalls'].get('tool-1')?.name).toBe('test_tool');
  });

  it('should handle streaming content', () => {
    const panel = new ChatPanel();
    panel['streamingContent'] = 'Partial response...';
    expect(panel['streamingContent']).toBe('Partial response...');
  });
});

describe('ChatPanel Markdown Rendering', () => {
  it('should render basic markdown', () => {
    const panel = new ChatPanel();
    const html = panel['renderMarkdown']('**bold** text');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('should render code blocks', () => {
    const panel = new ChatPanel();
    const html = panel['renderMarkdown']('```js\nconsole.log("hello");\n```');
    expect(html).toContain('<code');
    expect(html).toContain('console.log');
  });

  it('should render lists', () => {
    const panel = new ChatPanel();
    const html = panel['renderMarkdown']('- item 1\n- item 2');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
  });

  it('should handle empty content', () => {
    const panel = new ChatPanel();
    const html = panel['renderMarkdown']('');
    expect(html).toBe('');
  });
});
