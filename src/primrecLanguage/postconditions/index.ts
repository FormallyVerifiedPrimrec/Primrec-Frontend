// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import type { FunctionSignature } from '../types';
import { parsePostconditionSyntax } from './parser';
import { validatePostconditions } from './validation';
import type { PostconditionParseResult } from './types';

export function parsePostconditions(
  source: string,
  functionSignatures: readonly FunctionSignature[] = [],
): PostconditionParseResult {
  const syntax = parsePostconditionSyntax(source);
  const semantic = validatePostconditions(syntax.ast, functionSignatures);
  const diagnostics = [...syntax.diagnostics, ...semantic];

  return {
    ast: syntax.ast,
    tokens: syntax.tokens,
    diagnostics,
  };
}

export { parsePostconditionSyntax } from './parser';
export { validatePostconditions } from './validation';
export { stripPostconditionSectionsForPrimRec } from './sections';
export type {
  BooleanExpression as PostBooleanExpression,
  BinaryExpression as PostBinaryExpression,
  CallExpression as PostCallExpression,
  ErrorExpression as PostErrorExpression,
  FormulaStatement,
  IdentifierExpression as PostIdentifierExpression,
  IdentifierNode as PostIdentifierNode,
  IteExpression as PostIteExpression,
  LetExpression as PostLetExpression,
  LetStatement,
  NumberExpression as PostNumberExpression,
  PostExpression,
  PostconditionDefinition,
  PostconditionParseResult,
  PostconditionProgramAst,
  PostconditionStatement,
  PostToken,
  QuantifierExpression as PostQuantifierExpression,
  RawSmtBlock,
  RawSmtExpression as PostRawSmtExpression,
  RawSmtStatement,
  UnaryExpression as PostUnaryExpression,
} from './types';