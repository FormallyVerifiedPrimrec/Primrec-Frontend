// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  code: string;
  message: string;
  range: SourceRange;
  severity: DiagnosticSeverity;
}

export type TokenKind =
  | 'identifier'
  | 'number'
  | 'punctuation'
  | 'operator'
  | 'eof';

export interface Token {
  kind: TokenKind;
  value: string;
  range: SourceRange;
}

export interface ProgramAst {
  kind: 'Program';
  definitions: FunctionDefinition[];
  range: SourceRange;
}

export interface FunctionDefinition {
  kind: 'FunctionDefinition';
  name: string;
  params: Parameter[];
  body: Expression;
  range: SourceRange;
  nameRange: SourceRange;
}

export interface Parameter {
  kind: 'Parameter';
  name: string;
  range: SourceRange;
}

export type Expression =
  | VariableExpression
  | NumberLiteralExpression
  | CallExpression
  | PrimRecExpression
  | ErrorExpression;

export interface VariableExpression {
  kind: 'Variable';
  name: string;
  range: SourceRange;
}

export interface NumberLiteralExpression {
  kind: 'NumberLiteral';
  value: number;
  raw: string;
  range: SourceRange;
}

export interface CallExpression {
  kind: 'Call';
  callee: string;
  args: Expression[];
  range: SourceRange;
  calleeRange: SourceRange;
}

export interface PrimRecExpression {
  kind: 'PrimRec';
  base: string;
  step: string;
  range: SourceRange;
  baseRange: SourceRange;
  stepRange: SourceRange;
}

export interface ErrorExpression {
  kind: 'Error';
  range: SourceRange;
}

export interface FunctionSignature {
  name: string;
  arity: number;
  range?: SourceRange;
  builtin: boolean;
}

export type CoreExpression =
  | { kind: 'Projection'; parameter: string; index: number }
  | { kind: 'Number'; value: number }
  | { kind: 'Zero' }
  | { kind: 'Successor'; argument: CoreExpression }
  | { kind: 'Composition'; callee: string; args: CoreExpression[] }
  | PrimitiveRecursionCoreExpression;

export interface PrimitiveRecursionCoreExpression {
  kind: 'PrimitiveRecursion';
  base: string;
  step: string;
  idiom?: PrimitiveRecursionIdiom;
}

export type PrimitiveRecursionIdiom =
  | {
      kind: 'Predecessor';
      counterIndex: number;
      previousIndex: number;
    }
  | {
      kind: 'ConstantAfterFirst';
      counterIndex: number;
      previousIndex: number;
      expression: CoreExpression;
    }
  | {
      kind: 'LinearRecurrence';
      counterIndex: number;
      previousIndex: number;
      increment: CoreExpression;
    };

export interface NormalizedFunction {
  name: string;
  arity: number;
  parameters: string[];
  expression: CoreExpression;
  dependencies: string[];
  range: SourceRange;
}

export interface NormalizedProgram {
  kind: 'PrimitiveRecursiveProgram';
  functions: NormalizedFunction[];
  signatures: Record<string, FunctionSignature>;
}

export interface ParseResult {
  ast: ProgramAst;
  tokens: Token[];
  diagnostics: Diagnostic[];
  program?: NormalizedProgram;
}