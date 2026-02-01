import { describe, it, expect } from 'bun:test';
import { StatusBoard } from '../components/StatusBoard.js';

describe('StatusBoard', () => {
  it('should be defined', () => {
    expect(StatusBoard).toBeDefined();
  });

  it('should have correct element name', () => {
    const board = new StatusBoard();
    expect(board.tagName.toLowerCase()).toBe('status-board');
  });
});
