// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import type { Diagnostic, SourcePosition, SourceRange, Token } from '../types';

export function createPosition(
  offset: number,
  line: number,
  column: number,
): SourcePosition {
  return { offset, line, column };
}

export function createRange(
  start: SourcePosition,
  end: SourcePosition,
): SourceRange {
  return { start, end };
}

export function mergeRanges(first: SourceRange, second: SourceRange): SourceRange {
  return { start: first.start, end: second.end };
}

export function tokenRange(token: Token): SourceRange {
  return token.range;
}

export function emptyRangeAt(position: SourcePosition): SourceRange {
  return { start: position, end: { ...position, column: position.column + 1 } };
}

export function diagnostic(
  code: string,
  message: string,
  range: SourceRange,
  severity: 'error' | 'warning' = 'error',
): Diagnostic {
  return { code, message, range, severity };
}

export function containsPosition(
  range: SourceRange,
  line: number,
  column: number,
): boolean {
  if (line < range.start.line || line > range.end.line) {
    return false;
  }

  if (line === range.start.line && column < range.start.column) {
    return false;
  }

  if (line === range.end.line && column > range.end.column) {
    return false;
  }

  return true;
}

export function zeroWidthRangeAt(token: Token): SourceRange {
  return { start: token.range.start, end: token.range.start };
}