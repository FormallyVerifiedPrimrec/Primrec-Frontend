// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import type { Diagnostic, SourceRange } from '../types';

export type PostTokenKind =
  | 'identifier'
  | 'number'
  | 'punctuation'
  | 'operator'
  | 'raw_smt'
  | 'eof';

export interface PostToken {
  kind: PostTokenKind;
  value: string;
  range: SourceRange;
}

export interface PostconditionProgramAst {
  kind: 'PostconditionProgram';
  postconditions: PostconditionDefinition[];
  smtBlocks: RawSmtBlock[];
  range: SourceRange;
}

export interface IdentifierNode {
  kind: 'Identifier';
  name: string;
  range: SourceRange;
}

export interface PostconditionDefinition {
  kind: 'PostconditionDefinition';
  functionName: string;
  params: IdentifierNode[];
  result: IdentifierNode;
  statements: PostconditionStatement[];
  range: SourceRange;
  functionNameRange: SourceRange;
}

export type PostconditionStatement =
  | FormulaStatement
  | LetStatement
  | RawSmtStatement;

export interface FormulaStatement {
  kind: 'FormulaStatement';
  expression: PostExpression;
  range: SourceRange;
}

export interface LetStatement {
  kind: 'LetStatement';
  name: IdentifierNode;
  value: PostExpression;
  range: SourceRange;
}

export interface RawSmtStatement {
  kind: 'RawSmtStatement';
  block: RawSmtBlock;
  range: SourceRange;
}

export interface RawSmtBlock {
  kind: 'RawSmtBlock';
  text: string;
  range: SourceRange;
  keywordRange: SourceRange;
}

export type QuantifierKind = 'forall' | 'exists';

export type PostExpression =
  | IdentifierExpression
  | NumberExpression
  | BooleanExpression
  | UnaryExpression
  | BinaryExpression
  | CallExpression
  | QuantifierExpression
  | IteExpression
  | LetExpression
  | RawSmtExpression
  | ErrorExpression;

export interface IdentifierExpression {
  kind: 'IdentifierExpression';
  name: string;
  range: SourceRange;
}

export interface NumberExpression {
  kind: 'NumberExpression';
  value: number;
  raw: string;
  range: SourceRange;
}

export interface BooleanExpression {
  kind: 'BooleanExpression';
  value: boolean;
  range: SourceRange;
}

export interface UnaryExpression {
  kind: 'UnaryExpression';
  operator: '!' | '-';
  argument: PostExpression;
  range: SourceRange;
  operatorRange: SourceRange;
}

export interface BinaryExpression {
  kind: 'BinaryExpression';
  operator: string;
  left: PostExpression;
  right: PostExpression;
  range: SourceRange;
  operatorRange: SourceRange;
}

export interface CallExpression {
  kind: 'CallExpression';
  callee: string;
  args: PostExpression[];
  range: SourceRange;
  calleeRange: SourceRange;
}

export interface QuantifierExpression {
  kind: 'QuantifierExpression';
  quantifier: QuantifierKind;
  variables: IdentifierNode[];
  body: PostExpression;
  range: SourceRange;
  quantifierRange: SourceRange;
}

export interface IteExpression {
  kind: 'IteExpression';
  condition: PostExpression;
  thenBranch: PostExpression;
  elseBranch: PostExpression;
  range: SourceRange;
  keywordRange: SourceRange;
}

export interface LetExpression {
  kind: 'LetExpression';
  name: IdentifierNode;
  value: PostExpression;
  body: PostExpression;
  range: SourceRange;
  keywordRange: SourceRange;
}

export interface RawSmtExpression {
  kind: 'RawSmtExpression';
  block: RawSmtBlock;
  range: SourceRange;
}

export interface ErrorExpression {
  kind: 'ErrorExpression';
  range: SourceRange;
}

export interface PostconditionParseResult {
  ast: PostconditionProgramAst;
  tokens: PostToken[];
  diagnostics: Diagnostic[];
}