import { BUILTIN_SIGNATURES } from '../primrecLanguage/constants';
import { lex } from '../primrecLanguage/lexer';
import type { FunctionSignature, Token } from '../primrecLanguage/types';

export type PrimRecDependencyRole = 'base' | 'step';

export interface PrimRecDependencyCompletionContext {
  role: PrimRecDependencyRole;
  expectedArity: number;
  definitionStartOffset?: number;
}

interface ParenFrame {
  calleeIndex?: number;
  calleeName?: string;
  commaCount: number;
}

interface DefinitionHeader {
  arity: number;
  startOffset: number;
}

const BUILTIN_COMPLETION_SIGNATURES: FunctionSignature[] = [
  { ...BUILTIN_SIGNATURES.zero },
  { ...BUILTIN_SIGNATURES.succ },
];

export function getPrimRecDependencyCompletionContext(
  source: string,
  offset: number,
): PrimRecDependencyCompletionContext | undefined {
  const tokens = lex(source).tokens.filter(
    (token) => token.kind !== 'eof' && token.range.start.offset < offset,
  );
  const stack: ParenFrame[] = [];
  let previousToken: Token | undefined;

  tokens.forEach((token, index) => {
    if (token.value === '(') {
      const callee =
        previousToken?.kind === 'identifier'
          ? { calleeName: previousToken.value, calleeIndex: index - 1 }
          : {};
      stack.push({ ...callee, commaCount: 0 });
    } else if (token.value === ')') {
      stack.pop();
    } else if (token.value === ',') {
      const frame = stack[stack.length - 1];
      if (frame) {
        frame.commaCount += 1;
      }
    }

    previousToken = token;
  });

  const frame = stack[stack.length - 1];
  if (!frame || frame.calleeName !== 'primrec' || frame.calleeIndex === undefined) {
    return undefined;
  }

  const role = getPrimRecDependencyRole(frame.commaCount);
  if (!role) {
    return undefined;
  }

  const definition = findDefinitionHeader(tokens, frame.calleeIndex);
  const expectedArity = getExpectedDependencyArity(definition?.arity, role);

  return {
    role,
    expectedArity,
    definitionStartOffset: definition?.startOffset,
  };
}

export function getPrimRecDependencyCompletionSignatures(
  signatures: FunctionSignature[],
  context: PrimRecDependencyCompletionContext,
): FunctionSignature[] {
  const candidates = [...BUILTIN_COMPLETION_SIGNATURES, ...signatures];

  return candidates.filter((signature) => {
    if (signature.arity !== context.expectedArity) {
      return false;
    }

    if (signature.builtin || context.definitionStartOffset === undefined) {
      return true;
    }

    return (
      signature.range === undefined ||
      signature.range.start.offset < context.definitionStartOffset
    );
  });
}

function getPrimRecDependencyRole(
  commaCount: number,
): PrimRecDependencyRole | undefined {
  if (commaCount === 0) {
    return 'base';
  }

  if (commaCount === 1) {
    return 'step';
  }

  return undefined;
}

function getExpectedDependencyArity(
  definitionArity: number | undefined,
  role: PrimRecDependencyRole,
): number {
  if (definitionArity === undefined || definitionArity === 0) {
    return -1;
  }

  return role === 'base' ? definitionArity - 1 : definitionArity + 1;
}

function findDefinitionHeader(
  tokens: Token[],
  beforeIndex: number,
): DefinitionHeader | undefined {
  const statementStart = findStatementStart(tokens, beforeIndex);
  const equalsIndex = findPreviousTokenIndex(tokens, beforeIndex, statementStart, '=');
  if (equalsIndex === undefined) {
    return undefined;
  }

  const nameIndex = findNextIdentifierIndex(tokens, statementStart, equalsIndex);
  if (nameIndex === undefined) {
    return undefined;
  }

  const openIndex = findNextTokenIndex(tokens, nameIndex + 1, equalsIndex, '(');
  if (openIndex === undefined) {
    return undefined;
  }

  const closeIndex = findMatchingCloseParen(tokens, openIndex, equalsIndex);
  if (closeIndex === undefined) {
    return undefined;
  }

  return {
    arity: countTopLevelIdentifiers(tokens, openIndex + 1, closeIndex),
    startOffset: tokens[nameIndex].range.start.offset,
  };
}

function findStatementStart(tokens: Token[], beforeIndex: number): number {
  for (let index = beforeIndex; index >= 0; index -= 1) {
    if (tokens[index].value === ';') {
      return index + 1;
    }
  }

  return 0;
}

function findPreviousTokenIndex(
  tokens: Token[],
  beforeIndex: number,
  minIndex: number,
  value: string,
): number | undefined {
  for (let index = beforeIndex; index >= minIndex; index -= 1) {
    if (tokens[index].value === value) {
      return index;
    }
  }

  return undefined;
}

function findNextIdentifierIndex(
  tokens: Token[],
  startIndex: number,
  endIndex: number,
): number | undefined {
  for (let index = startIndex; index < endIndex; index += 1) {
    if (tokens[index].kind === 'identifier') {
      return index;
    }
  }

  return undefined;
}

function findNextTokenIndex(
  tokens: Token[],
  startIndex: number,
  endIndex: number,
  value: string,
): number | undefined {
  for (let index = startIndex; index < endIndex; index += 1) {
    if (tokens[index].value === value) {
      return index;
    }
  }

  return undefined;
}

function findMatchingCloseParen(
  tokens: Token[],
  openIndex: number,
  beforeIndex: number,
): number | undefined {
  let depth = 0;

  for (let index = openIndex; index < beforeIndex; index += 1) {
    if (tokens[index].value === '(') {
      depth += 1;
    } else if (tokens[index].value === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return undefined;
}

function countTopLevelIdentifiers(
  tokens: Token[],
  startIndex: number,
  endIndex: number,
): number {
  let count = 0;
  let depth = 0;

  for (let index = startIndex; index < endIndex; index += 1) {
    const token = tokens[index];

    if (token.value === '(') {
      depth += 1;
    } else if (token.value === ')') {
      depth -= 1;
    } else if (depth === 0 && token.kind === 'identifier') {
      count += 1;
    }
  }

  return count;
}
