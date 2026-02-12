import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';

import { registerMathTools } from '../math-tools';

type ToolHandler = (params: Record<string, unknown>) => {
  content: { type: string; text: string }[];
  isError?: boolean;
};

function setup(): ToolHandler {
  let handler: ToolHandler | undefined;
  const fakeServer = {
    registerTool: (_name: string, _config: unknown, h: ToolHandler) => {
      handler = h;
    },
  } as unknown as McpServer;

  registerMathTools(fakeServer);

  if (!handler) {
    throw new Error('registerMathTools did not register a tool');
  }
  return handler;
}

function calc(handler: ToolHandler, expression: string): number | string {
  const result = handler({ expression });
  const text = result.content[0].text;
  if (result.isError) {
    return text;
  }
  return Number(text);
}

describe('calculate', () => {
  const handler = setup();

  describe('basic arithmetic', () => {
    it('adds two numbers', () => {
      expect(calc(handler, '2 + 3')).toBe(5);
    });

    it('subtracts two numbers', () => {
      expect(calc(handler, '10 - 4')).toBe(6);
    });

    it('multiplies two numbers', () => {
      expect(calc(handler, '6 * 7')).toBe(42);
    });

    it('divides two numbers', () => {
      expect(calc(handler, '15 / 4')).toBe(3.75);
    });

    it('computes modulo', () => {
      expect(calc(handler, '17 % 5')).toBe(2);
    });

    it('handles decimals', () => {
      expect(calc(handler, '1.5 + 2.3')).toBeCloseTo(3.8);
    });

    it('handles leading decimal point', () => {
      expect(calc(handler, '.5 + .25')).toBeCloseTo(0.75);
    });
  });

  describe('operator precedence', () => {
    it('multiplies before adding', () => {
      expect(calc(handler, '2 + 3 * 4')).toBe(14);
    });

    it('divides before subtracting', () => {
      expect(calc(handler, '10 - 6 / 3')).toBe(8);
    });

    it('respects parentheses', () => {
      expect(calc(handler, '(2 + 3) * 4')).toBe(20);
    });

    it('handles nested parentheses', () => {
      expect(calc(handler, '((2 + 3) * (4 - 1))')).toBe(15);
    });
  });

  describe('unary operators', () => {
    it('negates a number', () => {
      expect(calc(handler, '-5')).toBe(-5);
    });

    it('double negation', () => {
      expect(calc(handler, '--5')).toBe(5);
    });

    it('unary plus', () => {
      expect(calc(handler, '+5')).toBe(5);
    });

    it('negation in expression', () => {
      expect(calc(handler, '3 + -2')).toBe(1);
    });
  });

  describe('functions', () => {
    it('round', () => {
      expect(calc(handler, 'round(3.7)')).toBe(4);
      expect(calc(handler, 'round(3.2)')).toBe(3);
    });

    it('floor', () => {
      expect(calc(handler, 'floor(3.9)')).toBe(3);
      expect(calc(handler, 'floor(-1.1)')).toBe(-2);
    });

    it('ceil', () => {
      expect(calc(handler, 'ceil(3.1)')).toBe(4);
      expect(calc(handler, 'ceil(-1.9)')).toBe(-1);
    });

    it('abs', () => {
      expect(calc(handler, 'abs(-7)')).toBe(7);
      expect(calc(handler, 'abs(7)')).toBe(7);
    });

    it('sqrt', () => {
      expect(calc(handler, 'sqrt(16)')).toBe(4);
      expect(calc(handler, 'sqrt(2)')).toBeCloseTo(1.4142, 3);
    });

    it('pow', () => {
      expect(calc(handler, 'pow(2, 10)')).toBe(1024);
      expect(calc(handler, 'pow(3, 0)')).toBe(1);
    });

    it('min', () => {
      expect(calc(handler, 'min(5, 3)')).toBe(3);
      expect(calc(handler, 'min(1, 2, 3, 4)')).toBe(1);
    });

    it('max', () => {
      expect(calc(handler, 'max(5, 3)')).toBe(5);
      expect(calc(handler, 'max(1, 2, 3, 4)')).toBe(4);
    });
  });

  describe('nested expressions', () => {
    it('function with arithmetic argument', () => {
      expect(calc(handler, 'round((480 - 100) / 2)')).toBe(190);
    });

    it('arithmetic with function results', () => {
      expect(calc(handler, 'sqrt(3*3 + 4*4)')).toBe(5);
    });

    it('nested function calls', () => {
      expect(calc(handler, 'abs(min(-5, -10))')).toBe(10);
    });
  });

  describe('error cases', () => {
    it('empty expression', () => {
      const result = calc(handler, '');
      expect(typeof result).toBe('string');
      expect(result).toContain('Error');
    });

    it('whitespace-only expression', () => {
      const result = calc(handler, '   ');
      expect(typeof result).toBe('string');
      expect(result).toContain('Error');
    });

    it('division by zero', () => {
      const result = calc(handler, '1 / 0');
      expect(typeof result).toBe('string');
      expect(result).toContain('Division by zero');
    });

    it('unknown function', () => {
      const result = calc(handler, 'sin(1)');
      expect(typeof result).toBe('string');
      expect(result).toContain('Unknown function');
    });

    it('wrong argument count for single-arg function', () => {
      const result = calc(handler, 'round(1, 2)');
      expect(typeof result).toBe('string');
      expect(result).toContain('expects 1 argument');
    });

    it('wrong argument count for two-arg function', () => {
      const result = calc(handler, 'pow(2)');
      expect(typeof result).toBe('string');
      expect(result).toContain('expects 2 arguments');
    });

    it('min with no arguments', () => {
      const result = calc(handler, 'min()');
      expect(typeof result).toBe('string');
      expect(result).toContain('expects at least 1 argument');
    });

    it('invalid character', () => {
      const result = calc(handler, '2 & 3');
      expect(typeof result).toBe('string');
      expect(result).toContain('Unexpected character');
    });

    it('unmatched parenthesis', () => {
      const result = calc(handler, '(2 + 3');
      expect(typeof result).toBe('string');
      expect(result).toContain('Error');
    });

    it('missing operand', () => {
      const result = calc(handler, '2 +');
      expect(typeof result).toBe('string');
      expect(result).toContain('Error');
    });
  });
});
