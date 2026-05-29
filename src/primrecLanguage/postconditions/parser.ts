// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import { diagnostic, mergeRanges } from '../primrecParsing/ranges';
import type { Diagnostic, SourceRange } from '../types';
import { lexPostconditions } from './lexer';
import type {
  IdentifierNode,
  LetStatement,
  PostExpression,
  PostToken,
  PostconditionDefinition,
  PostconditionProgramAst,
  PostconditionStatement,
  QuantifierKind,
  RawSmtBlock,
} from './types';

interface ParserState {
  tokens: PostToken[];
  current: number;
  diagnostics: Diagnostic[];
  postconditions: PostconditionDefinition[];
  smtBlocks: RawSmtBlock[];
}

const BINARY_PRECEDENCE = new Map<string, number>([
  ['<=>', 1],
  ['=>', 2],
  ['||', 3],
  ['xor', 3],
  ['&&', 4],
  ['==', 5],
  ['!=', 5],
  ['<', 5],
  ['<=', 5],
  ['>', 5],
  ['>=', 5],
  ['+', 6],
  ['-', 6],
  ['*', 7],
  ['div', 7],
  ['mod', 7],
  ['**', 8],
]);

const RIGHT_ASSOCIATIVE = new Set(['=>', '**']);

export function parsePostconditionSyntax(source: string): {
  ast: PostconditionProgramAst;
  tokens: PostToken[];
  diagnostics: Diagnostic[];
} {
  const lexed = lexPostconditions(source);
  const state: ParserState = {
    tokens: lexed.tokens,
    current: 0,
    diagnostics: [...lexed.diagnostics],
    postconditions: [],
    smtBlocks: [],
  };

  while (!isAtEnd(state)) {
    if (matchIdentifierValue(state, 'post')) {
      state.postconditions.push(parsePostcondition(state, previous(state).range));
      continue;
    }

    if (matchIdentifierValue(state, 'smt')) {
      state.smtBlocks.push(parseRawSmtBlock(state, previous(state).range));
      continue;
    }

    advance(state);
  }

  const fallback = state.tokens[0]?.range ?? {
    start: { offset: 0, line: 1, column: 1 },
    end: { offset: 0, line: 1, column: 1 },
  };
  const ranges = [
    ...state.postconditions.map((item) => item.range),
    ...state.smtBlocks.map((item) => item.range),
  ];
  const ast: PostconditionProgramAst = {
    kind: 'PostconditionProgram',
    postconditions: state.postconditions,
    smtBlocks: state.smtBlocks,
    range: ranges.length > 0 ? mergeRanges(ranges[0], ranges[ranges.length - 1]) : fallback,
  };

  return {
    ast,
    tokens: lexed.tokens.filter((token) => token.kind !== 'eof'),
    diagnostics: state.diagnostics,
  };
}

function parsePostcondition(
  state: ParserState,
  startRange: SourceRange,
): PostconditionDefinition {
  const name = consumeKind(
    state,
    'identifier',
    'Expected a function name after post.',
  );
  consumeValue(state, '(', `Expected '(' after postcondition function name.`);
  const params = parseIdentifierList(state, ')');
  consumeValue(state, ')', "Expected ')' after postcondition parameters.");
  consumeValue(state, '->', "Expected '->' before the postcondition result name.");
  const result = consumeIdentifierNode(
    state,
    'Expected a result variable after ->.',
  );
  consumeValue(state, '{', "Expected '{' before the postcondition body.");

  const statements: PostconditionStatement[] = [];
  while (!isAtEnd(state) && !checkValue(state, '}')) {
    const statement = parseStatement(state);
    if (statement) {
      statements.push(statement);
      continue;
    }

    synchronizeStatement(state);
  }

  const close = consumeValue(state, '}', "Expected '}' after the postcondition body.");
  const fallbackRange = result?.range ?? name?.range ?? startRange;

  return {
    kind: 'PostconditionDefinition',
    functionName: name?.value ?? '',
    params,
    result: result ?? {
      kind: 'Identifier',
      name: '',
      range: fallbackRange,
    },
    statements,
    functionNameRange: name?.range ?? fallbackRange,
    range: mergeRanges(startRange, close?.range ?? fallbackRange),
  };
}

function parseIdentifierList(state: ParserState, terminator: string): IdentifierNode[] {
  const params: IdentifierNode[] = [];

  if (checkValue(state, terminator) || isAtEnd(state)) {
    return params;
  }

  do {
    const param = consumeIdentifierNode(state, 'Expected an identifier.');
    if (!param) {
      break;
    }
    params.push(param);
  } while (matchValue(state, ','));

  return params;
}

function parseStatement(state: ParserState): PostconditionStatement | undefined {
  if (matchIdentifierValue(state, 'smt')) {
    const block = parseRawSmtBlock(state, previous(state).range);
    return { kind: 'RawSmtStatement', block, range: block.range };
  }

  if (matchIdentifierValue(state, 'let')) {
    return parseLetStatement(state, previous(state).range);
  }

  const expression = parseExpression(state);
  const semicolon = consumeValue(state, ';', "Expected ';' after the formula.");
  return {
    kind: 'FormulaStatement',
    expression,
    range: mergeRanges(expression.range, semicolon?.range ?? expression.range),
  };
}

function parseLetStatement(
  state: ParserState,
  startRange: SourceRange,
): LetStatement {
  const name = consumeIdentifierNode(state, 'Expected a local name after let.');
  consumeValue(state, '=', "Expected '=' in let statement.");
  const value = parseExpression(state);
  const semicolon = consumeValue(state, ';', "Expected ';' after let statement.");
  const fallbackRange = name?.range ?? value.range;

  return {
    kind: 'LetStatement',
    name: name ?? { kind: 'Identifier', name: '', range: fallbackRange },
    value,
    range: mergeRanges(startRange, semicolon?.range ?? value.range),
  };
}

function parseRawSmtBlock(
  state: ParserState,
  keywordRange: SourceRange,
): RawSmtBlock {
  consumeValue(state, '{', "Expected '{' after smt.");
  const raw = matchKind(state, 'raw_smt') ? previous(state) : undefined;
  const close = consumeValue(state, '}', "Expected '}' after raw SMT block.");
  const endRange = close?.range ?? raw?.range ?? keywordRange;

  return {
    kind: 'RawSmtBlock',
    text: raw?.value ?? '',
    keywordRange,
    range: mergeRanges(keywordRange, endRange),
  };
}

function parseExpression(state: ParserState, minPrecedence = 1): PostExpression {
  let left = parsePrefixExpression(state);

  while (true) {
    const operator = currentBinaryOperator(state);
    if (!operator) {
      return left;
    }

    const precedence = BINARY_PRECEDENCE.get(operator.value);
    if (precedence === undefined || precedence < minPrecedence) {
      return left;
    }

    advance(state);
    const nextMin = RIGHT_ASSOCIATIVE.has(operator.value) ? precedence : precedence + 1;
    const right = parseExpression(state, nextMin);
    left = {
      kind: 'BinaryExpression',
      operator: operator.value,
      left,
      right,
      operatorRange: operator.range,
      range: mergeRanges(left.range, right.range),
    };
  }
}

function parsePrefixExpression(state: ParserState): PostExpression {
  if (matchValue(state, '!') || matchValue(state, '-')) {
    const operator = previous(state);
    const argument = parseExpression(state, 9);
    return {
      kind: 'UnaryExpression',
      operator: operator.value as '!' | '-',
      argument,
      operatorRange: operator.range,
      range: mergeRanges(operator.range, argument.range),
    };
  }

  if (matchIdentifierValue(state, 'forall') || matchIdentifierValue(state, 'exists')) {
    return parseQuantifier(state, previous(state).value as QuantifierKind, previous(state).range);
  }

  if (matchIdentifierValue(state, 'let')) {
    return parseLetExpression(state, previous(state).range);
  }

  if (matchIdentifierValue(state, 'smt')) {
    const block = parseRawSmtBlock(state, previous(state).range);
    return { kind: 'RawSmtExpression', block, range: block.range };
  }

  return parsePrimaryExpression(state);
}

function parsePrimaryExpression(state: ParserState): PostExpression {
  if (matchKind(state, 'number')) {
    const token = previous(state);
    return {
      kind: 'NumberExpression',
      value: Number.parseInt(token.value, 10),
      raw: token.value,
      range: token.range,
    };
  }

  if (matchIdentifierValue(state, 'true') || matchIdentifierValue(state, 'false')) {
    const token = previous(state);
    return {
      kind: 'BooleanExpression',
      value: token.value === 'true',
      range: token.range,
    };
  }

  if (matchIdentifierValue(state, 'ite')) {
    return parseIteExpression(state, previous(state).range);
  }

  if (matchValue(state, '(')) {
    const open = previous(state);
    const expression = parseExpression(state);
    const close = consumeValue(state, ')', "Expected ')' after expression.");
    return { ...expression, range: mergeRanges(open.range, close?.range ?? expression.range) };
  }

  if (matchKind(state, 'identifier')) {
    const identifier = previous(state);
    if (!matchValue(state, '(')) {
      return {
        kind: 'IdentifierExpression',
        name: identifier.value,
        range: identifier.range,
      };
    }

    const args = parseExpressionList(state, ')');
    const close = consumeValue(state, ')', "Expected ')' after function arguments.");
    return {
      kind: 'CallExpression',
      callee: identifier.value,
      args,
      calleeRange: identifier.range,
      range: mergeRanges(identifier.range, close?.range ?? lastExpressionRange(args) ?? identifier.range),
    };
  }

  const token = peek(state);
  state.diagnostics.push(
    diagnostic(
      'POST_PARSE_EXPECTED_EXPRESSION',
      'Expected a postcondition expression.',
      token.range,
    ),
  );
  if (!isAtEnd(state)) {
    advance(state);
  }
  return { kind: 'ErrorExpression', range: token.range };
}

function parseExpressionList(state: ParserState, terminator: string): PostExpression[] {
  const args: PostExpression[] = [];

  if (checkValue(state, terminator) || isAtEnd(state)) {
    return args;
  }

  do {
    args.push(parseExpression(state));
  } while (matchValue(state, ','));

  return args;
}

function parseIteExpression(
  state: ParserState,
  keywordRange: SourceRange,
): PostExpression {
  consumeValue(state, '(', "Expected '(' after ite.");
  const condition = parseExpression(state);
  consumeValue(state, ',', "Expected ',' after ite condition.");
  const thenBranch = parseExpression(state);
  consumeValue(state, ',', "Expected ',' after ite then branch.");
  const elseBranch = parseExpression(state);
  const close = consumeValue(state, ')', "Expected ')' after ite expression.");

  return {
    kind: 'IteExpression',
    condition,
    thenBranch,
    elseBranch,
    keywordRange,
    range: mergeRanges(keywordRange, close?.range ?? elseBranch.range),
  };
}

function parseQuantifier(
  state: ParserState,
  quantifier: QuantifierKind,
  quantifierRange: SourceRange,
): PostExpression {
  const variables = parseIdentifierList(state, '.');
  consumeValue(state, '.', "Expected '.' after quantified variables.");
  const body = parseExpression(state);

  return {
    kind: 'QuantifierExpression',
    quantifier,
    variables,
    body,
    quantifierRange,
    range: mergeRanges(quantifierRange, body.range),
  };
}

function parseLetExpression(
  state: ParserState,
  keywordRange: SourceRange,
): PostExpression {
  const name = consumeIdentifierNode(state, 'Expected a local name after let.');
  consumeValue(state, '=', "Expected '=' in let expression.");
  const value = parseExpression(state);
  consumeIdentifierValue(state, 'in', "Expected 'in' in let expression.");
  const body = parseExpression(state);
  const fallbackRange = name?.range ?? value.range;

  return {
    kind: 'LetExpression',
    name: name ?? { kind: 'Identifier', name: '', range: fallbackRange },
    value,
    body,
    keywordRange,
    range: mergeRanges(keywordRange, body.range),
  };
}

function currentBinaryOperator(state: ParserState): PostToken | undefined {
  const token = peek(state);
  if (token.kind === 'operator' && BINARY_PRECEDENCE.has(token.value)) {
    return token;
  }

  if (token.kind === 'identifier' && BINARY_PRECEDENCE.has(token.value)) {
    return token;
  }

  return undefined;
}

function lastExpressionRange(args: PostExpression[]): SourceRange | undefined {
  return args.length > 0 ? args[args.length - 1].range : undefined;
}

function synchronizeStatement(state: ParserState) {
  while (!isAtEnd(state)) {
    if (previous(state).value === ';' || checkValue(state, '}')) {
      return;
    }
    advance(state);
  }
}

function consumeIdentifierNode(
  state: ParserState,
  message: string,
): IdentifierNode | undefined {
  const token = consumeKind(state, 'identifier', message);
  return token ? { kind: 'Identifier', name: token.value, range: token.range } : undefined;
}

function consumeIdentifierValue(
  state: ParserState,
  value: string,
  message: string,
): PostToken | undefined {
  if (checkKindValue(state, 'identifier', value)) {
    return advance(state);
  }

  state.diagnostics.push(diagnostic('POST_PARSE_UNEXPECTED_TOKEN', message, peek(state).range));
  return undefined;
}

function consumeKind(
  state: ParserState,
  kind: PostToken['kind'],
  message: string,
): PostToken | undefined {
  if (check(state, kind)) {
    return advance(state);
  }

  state.diagnostics.push(diagnostic('POST_PARSE_UNEXPECTED_TOKEN', message, peek(state).range));
  return undefined;
}

function consumeValue(
  state: ParserState,
  value: string,
  message: string,
): PostToken | undefined {
  if (checkValue(state, value)) {
    return advance(state);
  }

  state.diagnostics.push(diagnostic('POST_PARSE_UNEXPECTED_TOKEN', message, peek(state).range));
  return undefined;
}

function matchKind(state: ParserState, kind: PostToken['kind']): boolean {
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

function matchIdentifierValue(state: ParserState, value: string): boolean {
  if (!checkKindValue(state, 'identifier', value)) {
    return false;
  }

  advance(state);
  return true;
}

function check(state: ParserState, kind: PostToken['kind']): boolean {
  return peek(state).kind === kind;
}

function checkValue(state: ParserState, value: string): boolean {
  return peek(state).value === value;
}

function checkKindValue(
  state: ParserState,
  kind: PostToken['kind'],
  value: string,
): boolean {
  const token = peek(state);
  return token.kind === kind && token.value === value;
}

function advance(state: ParserState): PostToken {
  if (!isAtEnd(state)) {
    state.current += 1;
  }
  return previous(state);
}

function isAtEnd(state: ParserState): boolean {
  return peek(state).kind === 'eof';
}

function peek(state: ParserState): PostToken {
  return state.tokens[state.current];
}

function previous(state: ParserState): PostToken {
  return state.tokens[state.current - 1];
}