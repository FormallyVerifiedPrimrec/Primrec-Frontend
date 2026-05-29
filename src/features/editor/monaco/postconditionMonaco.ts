// Ported from the PrimRecEditor reference editor (src/editor/postconditionMonaco.ts) with only
// import paths adjusted for the frontend folder layout.
import type * as Monaco from 'monaco-editor';
import type {
  PostExpression,
  PostconditionDefinition,
  SourceRange,
} from '../../../primrecLanguage';

type MonacoApi = typeof Monaco;

export const POSTCONDITION_SEMANTIC_TOKEN_TYPES = [
  'keyword.postcondition',
  'keyword.smt',
  'postcondition.function',
  'postcondition.result',
  'postcondition.quantifier',
  'postcondition.operator',
  'postcondition.builtin',
] as const;

export type PostconditionSemanticTokenType =
  (typeof POSTCONDITION_SEMANTIC_TOKEN_TYPES)[number];

export interface PostconditionSemanticTokenSpan {
  range: SourceRange;
  tokenType: string;
  length?: number;
}

export function getPostconditionCompletionItems(
  monaco: MonacoApi,
  range: Monaco.IRange,
): Monaco.languages.CompletionItem[] {
  return [
    {
      label: 'forall',
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText: 'forall ${1:k}. ${2:k >= 0 => true}',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: 'forall k. formula',
      range,
    },
    {
      label: 'exists',
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText: 'exists ${1:k}. ${2:true}',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: 'exists k. formula',
      range,
    },
    {
      label: 'ite',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'ite(${1:condition}, ${2:thenValue}, ${3:elseValue})',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: 'SMT-LIB if-then-else',
      range,
    },
    {
      label: 'divisible',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'divisible(${1:2}, ${2:x})',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: 'SMT-LIB ((_ divisible n) x)',
      range,
    },
    {
      label: 'smt',
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText: 'smt {\n  ${1:; raw SMT-LIB}\n}',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: 'Raw SMT-LIB block',
      range,
    },
  ];
}

export function collectPostconditionSemanticTokens(
  definition: PostconditionDefinition,
  tokens: PostconditionSemanticTokenSpan[],
) {
  tokens.push({
    range: definition.functionNameRange,
    tokenType: 'postcondition.function',
  });
  definition.params.forEach((param) => {
    tokens.push({ range: param.range, tokenType: 'parameter.definition' });
  });
  tokens.push({ range: definition.result.range, tokenType: 'postcondition.result' });

  definition.statements.forEach((statement) => {
    switch (statement.kind) {
      case 'FormulaStatement':
        collectPostExpressionSemanticTokens(statement.expression, tokens);
        return;

      case 'LetStatement':
        tokens.push({ range: statement.name.range, tokenType: 'parameter.definition' });
        collectPostExpressionSemanticTokens(statement.value, tokens);
        return;

      case 'RawSmtStatement':
        tokens.push({
          range: statement.block.keywordRange,
          tokenType: 'keyword.smt',
          length: 'smt'.length,
        });
        return;
    }
  });
}

function collectPostExpressionSemanticTokens(
  expression: PostExpression,
  tokens: PostconditionSemanticTokenSpan[],
) {
  switch (expression.kind) {
    case 'IdentifierExpression':
      tokens.push({ range: expression.range, tokenType: 'variable.reference' });
      return;

    case 'NumberExpression':
      tokens.push({ range: expression.range, tokenType: 'number.literal' });
      return;

    case 'BooleanExpression':
      tokens.push({ range: expression.range, tokenType: 'keyword.postcondition' });
      return;

    case 'UnaryExpression':
      tokens.push({
        range: expression.operatorRange,
        tokenType: 'postcondition.operator',
      });
      collectPostExpressionSemanticTokens(expression.argument, tokens);
      return;

    case 'BinaryExpression':
      tokens.push({
        range: expression.operatorRange,
        tokenType: 'postcondition.operator',
      });
      collectPostExpressionSemanticTokens(expression.left, tokens);
      collectPostExpressionSemanticTokens(expression.right, tokens);
      return;

    case 'CallExpression':
      tokens.push({
        range: expression.calleeRange,
        tokenType: isPostconditionBuiltin(expression.callee)
          ? 'postcondition.builtin'
          : 'function.call',
      });
      expression.args.forEach((arg) => collectPostExpressionSemanticTokens(arg, tokens));
      return;

    case 'QuantifierExpression':
      tokens.push({
        range: expression.quantifierRange,
        tokenType: 'postcondition.quantifier',
      });
      expression.variables.forEach((variable) => {
        tokens.push({ range: variable.range, tokenType: 'parameter.definition' });
      });
      collectPostExpressionSemanticTokens(expression.body, tokens);
      return;

    case 'IteExpression':
      tokens.push({
        range: expression.keywordRange,
        tokenType: 'postcondition.builtin',
        length: 'ite'.length,
      });
      collectPostExpressionSemanticTokens(expression.condition, tokens);
      collectPostExpressionSemanticTokens(expression.thenBranch, tokens);
      collectPostExpressionSemanticTokens(expression.elseBranch, tokens);
      return;

    case 'LetExpression':
      tokens.push({
        range: expression.keywordRange,
        tokenType: 'keyword.postcondition',
        length: 'let'.length,
      });
      tokens.push({ range: expression.name.range, tokenType: 'parameter.definition' });
      collectPostExpressionSemanticTokens(expression.value, tokens);
      collectPostExpressionSemanticTokens(expression.body, tokens);
      return;

    case 'RawSmtExpression':
      tokens.push({
        range: expression.block.keywordRange,
        tokenType: 'keyword.smt',
        length: 'smt'.length,
      });
      return;

    case 'ErrorExpression':
      return;
  }
}

function isPostconditionBuiltin(name: string): boolean {
  return ['abs', 'divisible', 'distinct'].includes(name);
}