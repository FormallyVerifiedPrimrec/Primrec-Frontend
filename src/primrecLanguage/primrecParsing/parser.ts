// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import { lex } from './lexer';
import { diagnostic, mergeRanges, tokenRange } from './ranges';
import type {
  Diagnostic,
  Expression,
  FunctionDefinition,
  Parameter,
  PrimRecExpression,
  ProgramAst,
  SourceRange,
  Token,
} from '../types';

interface ParserState {
  tokens: Token[];
  current: number;
  diagnostics: Diagnostic[];
  definitions: FunctionDefinition[];
}

export function parseSyntax(source: string): {
  ast: ProgramAst;
  tokens: Token[];
  diagnostics: Diagnostic[];
} {
  const lexed = lex(source);
  const state: ParserState = {
    tokens: lexed.tokens,
    current: 0,
    diagnostics: [...lexed.diagnostics],
    definitions: [],
  };

  while (!isAtEnd(state)) {
    const definition = parseDefinition(state);
    if (definition) {
      state.definitions.push(definition);
      continue;
    }

    synchronize(state);
  }

  const fallback = state.tokens[0]?.range ?? {
    start: { offset: 0, line: 1, column: 1 },
    end: { offset: 0, line: 1, column: 1 },
  };
  const ast: ProgramAst = {
    kind: 'Program',
    definitions: state.definitions,
    range:
      state.definitions.length > 0
        ? mergeRanges(
            state.definitions[0].range,
            state.definitions[state.definitions.length - 1].range,
          )
        : fallback,
  };

  return {
    ast,
    tokens: lexed.tokens.filter((token) => token.kind !== 'eof'),
    diagnostics: state.diagnostics,
  };
}

function parseDefinition(state: ParserState): FunctionDefinition | undefined {
  const name = consumeKind(
    state,
    'identifier',
    'Expected a function name at the start of a definition.',
  );
  if (!name) {
    return undefined;
  }

  consumeValue(state, '(', `Expected '(' after function name '${name.value}'.`);
  const params = parseParameterList(state);
  consumeValue(state, ')', "Expected ')' after the parameter list.");
  consumeValue(state, '=', "Expected '=' before the function body.");
  const body = parseExpression(state);
  const semicolon = consumeValue(
    state,
    ';',
    "Expected ';' after the function definition.",
  );

  return {
    kind: 'FunctionDefinition',
    name: name.value,
    params,
    body,
    nameRange: name.range,
    range: mergeRanges(name.range, semicolon?.range ?? body.range),
  };
}

function parseParameterList(state: ParserState): Parameter[] {
  const params: Parameter[] = [];

  if (checkValue(state, ')') || isAtEnd(state)) {
    return params;
  }

  do {
    const param = consumeKind(state, 'identifier', 'Expected a parameter name.');
    if (!param) {
      break;
    }

    params.push({ kind: 'Parameter', name: param.value, range: param.range });
  } while (matchValue(state, ','));

  return params;
}

function parseExpression(state: ParserState): Expression {
  if (matchKind(state, 'number')) {
    const token = previous(state);
    const value = Number.parseInt(token.value, 10);
    return { kind: 'NumberLiteral', value, raw: token.value, range: token.range };
  }

  if (!matchKind(state, 'identifier')) {
    const token = peek(state);
    state.diagnostics.push(
      diagnostic(
        'PARSE_EXPECTED_EXPRESSION',
        'Expected a variable, numeric literal, function call, or primrec expression.',
        tokenRange(token),
      ),
    );
    if (!isAtEnd(state)) {
      advance(state);
    }
    return { kind: 'Error', range: tokenRange(token) };
  }

  const identifier = previous(state);
  if (!matchValue(state, '(')) {
    return {
      kind: 'Variable',
      name: identifier.value,
      range: identifier.range,
    };
  }

  if (identifier.value === 'primrec') {
    return parsePrimRecExpression(state, identifier.range);
  }

  const args = parseArgumentList(state);
  const close = consumeValue(state, ')', "Expected ')' after function arguments.");
  return {
    kind: 'Call',
    callee: identifier.value,
    args,
    calleeRange: identifier.range,
    range: mergeRanges(identifier.range, close?.range ?? lastArgRange(args) ?? identifier.range),
  };
}

function parsePrimRecExpression(
  state: ParserState,
  startRange: SourceRange,
): PrimRecExpression {
  const base = consumeKind(
    state,
    'identifier',
    'Expected the base function name as the first primrec argument.',
  );
  consumeValue(state, ',', "Expected ',' between primrec base and step functions.");
  const step = consumeKind(
    state,
    'identifier',
    'Expected the step function name as the second primrec argument.',
  );
  const close = consumeValue(state, ')', "Expected ')' after primrec arguments.");
  const fallbackRange = base?.range ?? step?.range ?? startRange;

  return {
    kind: 'PrimRec',
    base: base?.value ?? '',
    step: step?.value ?? '',
    baseRange: base?.range ?? fallbackRange,
    stepRange: step?.range ?? fallbackRange,
    range: mergeRanges(startRange, close?.range ?? fallbackRange),
  };
}

function parseArgumentList(state: ParserState): Expression[] {
  const args: Expression[] = [];

  if (checkValue(state, ')') || isAtEnd(state)) {
    return args;
  }

  do {
    args.push(parseExpression(state));
  } while (matchValue(state, ','));

  return args;
}

function lastArgRange(args: Expression[]): SourceRange | undefined {
  return args.length > 0 ? args[args.length - 1].range : undefined;
}

function consumeKind(
  state: ParserState,
  kind: Token['kind'],
  message: string,
): Token | undefined {
  if (check(state, kind)) {
    return advance(state);
  }

  state.diagnostics.push(diagnostic('PARSE_UNEXPECTED_TOKEN', message, tokenRange(peek(state))));
  return undefined;
}

function consumeValue(
  state: ParserState,
  value: string,
  message: string,
): Token | undefined {
  if (checkValue(state, value)) {
    return advance(state);
  }

  state.diagnostics.push(diagnostic('PARSE_UNEXPECTED_TOKEN', message, tokenRange(peek(state))));
  return undefined;
}

function synchronize(state: ParserState) {
  while (!isAtEnd(state)) {
    if (previous(state).value === ';') {
      return;
    }

    if (checkKindValue(state, 'identifier') && lookaheadValue(state, 1) === '(') {
      return;
    }

    advance(state);
  }
}

function matchKind(state: ParserState, kind: Token['kind']): boolean {
  if (!check(state, kind)) {
    return false;
  }

  advance(state);
  return true;
}

function matchValue(state: ParserState, value: string): boolean {
  if (!checkValue(state, value)) {
    return false;
  }

  advance(state);
  return true;
}

function check(state: ParserState, kind: Token['kind']): boolean {
  return peek(state).kind === kind;
}

function checkKindValue(state: ParserState, kind: Token['kind'], value?: string): boolean {
  return peek(state).kind === kind && (value === undefined || peek(state).value === value);
}

function checkValue(state: ParserState, value: string): boolean {
  return peek(state).value === value;
}

function lookaheadValue(state: ParserState, offset: number): string | undefined {
  return state.tokens[state.current + offset]?.value;
}

function advance(state: ParserState): Token {
  if (!isAtEnd(state)) {
    state.current += 1;
  }

  return previous(state);
}

function isAtEnd(state: ParserState): boolean {
  return peek(state).kind === 'eof';
}

function peek(state: ParserState): Token {
  return state.tokens[state.current];
}

function previous(state: ParserState): Token {
  return state.tokens[Math.max(0, state.current - 1)];
}