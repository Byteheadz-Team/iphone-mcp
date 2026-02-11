import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// --- Safe math expression evaluator ---

type Token =
  | { type: 'number'; value: number }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: string }
  | { type: 'comma' }
  | { type: 'ident'; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (
      /\d/.test(ch) ||
      (ch === '.' && i + 1 < expr.length && /\d/.test(expr[i + 1]))
    ) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      const value = Number(num);
      if (Number.isNaN(value)) {
        throw new Error(`Invalid number: ${num}`);
      }
      tokens.push({ type: 'number', value });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < expr.length && /[a-zA-Z_\d]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }
      tokens.push({ type: 'ident', value: ident });
      continue;
    }

    if ('+-*/%'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: '${ch}'`);
  }

  return tokens;
}

class ExprParser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const result = this.additive();
    if (this.pos < this.tokens.length) {
      throw new Error(
        `Unexpected token: ${JSON.stringify(this.tokens[this.pos])}`,
      );
    }
    return result;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    if (!token) {
      throw new Error('Unexpected end of expression');
    }
    this.pos++;
    return token;
  }

  private consumeOp(): string {
    const token = this.advance();
    if (token.type !== 'op') {
      throw new Error(`Expected operator, got ${token.type}`);
    }
    return token.value;
  }

  private isOp(...values: string[]): boolean {
    const token = this.peek();
    return (
      token !== undefined && token.type === 'op' && values.includes(token.value)
    );
  }

  private isParen(value: string): boolean {
    const token = this.peek();
    return (
      token !== undefined && token.type === 'paren' && token.value === value
    );
  }

  private additive(): number {
    let left = this.multiplicative();
    while (this.isOp('+', '-')) {
      const op = this.consumeOp();
      const right = this.multiplicative();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private multiplicative(): number {
    let left = this.unary();
    while (this.isOp('*', '/', '%')) {
      const op = this.consumeOp();
      const right = this.unary();
      if (op === '*') {
        left *= right;
      } else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        left /= right;
      } else {
        left %= right;
      }
    }
    return left;
  }

  private unary(): number {
    if (this.isOp('-')) {
      this.advance();
      return -this.unary();
    }
    if (this.isOp('+')) {
      this.advance();
      return this.unary();
    }
    return this.atom();
  }

  private atom(): number {
    const token = this.peek();
    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    if (token.type === 'number') {
      this.advance();
      return token.value;
    }

    if (token.type === 'ident') {
      return this.functionCall();
    }

    if (this.isParen('(')) {
      this.advance();
      const result = this.additive();
      if (!this.isParen(')')) {
        throw new Error("Expected ')'");
      }
      this.advance();
      return result;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }

  private functionCall(): number {
    const nameToken = this.advance();
    if (nameToken.type !== 'ident') {
      throw new Error('Expected function name');
    }
    const name = nameToken.value;

    if (!this.isParen('(')) {
      throw new Error(`Expected '(' after '${name}'`);
    }
    this.advance();

    const args = this.argList();

    if (!this.isParen(')')) {
      throw new Error(`Expected ')' after arguments to '${name}'`);
    }
    this.advance();

    return this.callFunction(name, args);
  }

  private argList(): number[] {
    if (this.isParen(')')) {
      return [];
    }
    const args = [this.additive()];
    while (this.peek()?.type === 'comma') {
      this.advance();
      args.push(this.additive());
    }
    return args;
  }

  private callFunction(name: string, args: number[]): number {
    switch (name) {
      case 'round':
        this.expectArgCount(name, args, 1);
        return Math.round(args[0]);
      case 'floor':
        this.expectArgCount(name, args, 1);
        return Math.floor(args[0]);
      case 'ceil':
        this.expectArgCount(name, args, 1);
        return Math.ceil(args[0]);
      case 'abs':
        this.expectArgCount(name, args, 1);
        return Math.abs(args[0]);
      case 'sqrt':
        this.expectArgCount(name, args, 1);
        return Math.sqrt(args[0]);
      case 'pow':
        this.expectArgCount(name, args, 2);
        return Math.pow(args[0], args[1]);
      case 'min':
        this.expectMinArgs(name, args, 1);
        return Math.min(...args);
      case 'max':
        this.expectMinArgs(name, args, 1);
        return Math.max(...args);
      default:
        throw new Error(
          `Unknown function: '${name}'. Supported: round, floor, ceil, abs, sqrt, pow, min, max`,
        );
    }
  }

  private expectArgCount(name: string, args: number[], expected: number): void {
    if (args.length !== expected) {
      throw new Error(
        `${name}() expects ${expected} argument${expected === 1 ? '' : 's'}, got ${args.length}`,
      );
    }
  }

  private expectMinArgs(name: string, args: number[], min: number): void {
    if (args.length < min) {
      throw new Error(
        `${name}() expects at least ${min} argument${min === 1 ? '' : 's'}, got ${args.length}`,
      );
    }
  }
}

function evaluate(expression: string): number {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new Error('Empty expression');
  }
  const tokens = tokenize(trimmed);
  return new ExprParser(tokens).parse();
}

// --- MCP tool registration ---

export function registerMathTools(server: McpServer): void {
  server.registerTool(
    'calculate',
    {
      description:
        'Evaluate a mathematical expression. Use this tool for general arithmetic — never calculate in your head. For coordinate calculations, use get_coordinates instead. Supports: +, -, *, /, % (modulo), parentheses, and functions: round(), floor(), ceil(), abs(), sqrt(), pow(), min(), max(). Examples: "320 + 150", "round((480 - 100) / 2)", "min(100, 200)", "sqrt(3*3 + 4*4)".',
      inputSchema: {
        expression: z
          .string()
          .describe(
            'Mathematical expression to evaluate (e.g. "320 + 150", "round((480 - 100) / 2)", "min(100, 200, 300)")',
          ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    ({ expression }) => {
      try {
        const result = evaluate(expression);
        return {
          content: [{ type: 'text', text: String(result) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
