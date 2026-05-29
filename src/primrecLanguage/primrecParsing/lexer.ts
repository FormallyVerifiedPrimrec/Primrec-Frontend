// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import { diagnostic, emptyRangeAt } from './ranges';
import type { Diagnostic, SourcePosition, Token } from '../types';

interface LexerState {
  index: number;
  line: number;
  column: number;
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const PUNCTUATION = new Set(['(', ')', ',', ';']);
const OPERATORS = new Set(['=']);

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

export function lex(source: string): LexResult {
  const state: LexerState = {
    index: 0,
    line: 1,
    column: 1,
    tokens: [],
    diagnostics: [],
  };

  while (!isAtEnd(source, state)) {
    const char = current(source, state);

    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
      advance(source, state);
      continue;
    }

    if (char === '#') {
      skipLineComment(source, state);
      continue;
    }

    if (char === '/' && peek(source, state) === '*') {
      skipBlockComment(source, state);
      continue;
    }

    if (isIdentifierStart(char)) {
      readIdentifier(source, state);
      continue;
    }

    if (isDigit(char)) {
      readNumber(source, state);
      continue;
    }

    if (PUNCTUATION.has(char)) {
      const start = snapshot(state);
      addToken(state, 'punctuation', char, start, advance(source, state));
      continue;
    }

    if (OPERATORS.has(char)) {
      const start = snapshot(state);
      addToken(state, 'operator', char, start, advance(source, state));
      continue;
    }

    const start = snapshot(state);
    state.diagnostics.push(
      diagnostic(
        'LEX_UNKNOWN_CHARACTER',
        `Unexpected character '${char}'.`,
        emptyRangeAt(start),
      ),
    );
    advance(source, state);
  }

  const eof = snapshot(state);
  state.tokens.push({
    kind: 'eof',
    value: '',
    range: { start: eof, end: eof },
  });

  return { tokens: state.tokens, diagnostics: state.diagnostics };
}

function readIdentifier(source: string, state: LexerState) {
  const start = snapshot(state);
  let value = '';

  while (!isAtEnd(source, state) && isIdentifierPart(current(source, state))) {
    value += current(source, state);
    advance(source, state);
  }

  addToken(state, 'identifier', value, start, snapshot(state));
}

function readNumber(source: string, state: LexerState) {
  const start = snapshot(state);
  let value = '';

  while (!isAtEnd(source, state) && isDigit(current(source, state))) {
    value += current(source, state);
    advance(source, state);
  }

  addToken(state, 'number', value, start, snapshot(state));
}

function skipLineComment(source: string, state: LexerState) {
  while (!isAtEnd(source, state) && current(source, state) !== '\n') {
    advance(source, state);
  }
}

function skipBlockComment(source: string, state: LexerState) {
  const start = snapshot(state);
  advance(source, state);
  advance(source, state);

  while (!isAtEnd(source, state)) {
    if (current(source, state) === '*' && peek(source, state) === '/') {
      advance(source, state);
      advance(source, state);
      return;
    }

    advance(source, state);
  }

  state.diagnostics.push(
    diagnostic(
      'LEX_UNTERMINATED_BLOCK_COMMENT',
      'Block comments must be closed with */.',
      { start, end: snapshot(state) },
    ),
  );
}

function addToken(
  state: LexerState,
  kind: Token['kind'],
  value: string,
  start: SourcePosition,
  end: SourcePosition,
) {
  state.tokens.push({ kind, value, range: { start, end } });
}

function advance(source: string, state: LexerState): SourcePosition {
  const char = source[state.index];
  state.index += 1;

  if (char === '\n') {
    state.line += 1;
    state.column = 1;
  } else {
    state.column += 1;
  }

  return snapshot(state);
}

function snapshot(state: LexerState): SourcePosition {
  return {
    offset: state.index,
    line: state.line,
    column: state.column,
  };
}

function current(source: string, state: LexerState): string {
  return source[state.index] ?? '';
}

function peek(source: string, state: LexerState): string {
  return source[state.index + 1] ?? '';
}

function isAtEnd(source: string, state: LexerState): boolean {
  return state.index >= source.length;
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char);
}

function isDigit(char: string): boolean {
  return /[0-9]/.test(char);
}