// Monaco language integration for PrimRec.
// Ported from the PrimRecEditor reference editor and adapted to the frontend's
// folder layout. Adds postcondition + raw-SMT syntax highlighting, semantic
// tokens and diagnostics (via parseCompleteProgram). The frontend's original
// `primrec-light` theme is preserved alongside the ported `primrec-dark` theme.
import type * as Monaco from 'monaco-editor';
import {
  getPrimRecDependencyCompletionContext,
  getPrimRecDependencyCompletionSignatures,
} from './primRecCompletion';
import {
  collectPostconditionSemanticTokens,
  getPostconditionCompletionItems,
  POSTCONDITION_SEMANTIC_TOKEN_TYPES,
} from './postconditionMonaco';
import {
  getFunctionSignatures,
  getSemanticHover,
  LANGUAGE_ID,
  parseCompleteProgram,
} from '../../../primrecLanguage';
import type {
  Diagnostic,
  Expression,
  FunctionDefinition,
  SourceRange,
} from '../../../primrecLanguage';

const MARKER_OWNER = 'primrec-parser';
let registered = false;

type MonacoApi = typeof Monaco;
type SemanticTokenType = (typeof SEMANTIC_TOKEN_TYPES)[number];

interface SemanticTokenSpan {
  range: SourceRange;
  tokenType: SemanticTokenType;
  length?: number;
}

const SEMANTIC_TOKEN_TYPES = [
  'function.definition',
  'function.call',
  'function.builtin',
  'function.primrec.base',
  'function.primrec.step',
  'parameter.definition',
  'variable.reference',
  'keyword.primitive',
  'number.literal',
  ...POSTCONDITION_SEMANTIC_TOKEN_TYPES,
] as const;

const SEMANTIC_TOKEN_LEGEND: Monaco.languages.SemanticTokensLegend = {
  tokenTypes: [...SEMANTIC_TOKEN_TYPES],
  tokenModifiers: [],
};

const SEMANTIC_TOKEN_INDEXES = new Map(
  SEMANTIC_TOKEN_TYPES.map((tokenType, index) => [tokenType, index]),
);

export function registerPrimRecLanguage(monaco: MonacoApi) {
  if (registered) {
    return;
  }

  monaco.languages.register({
    id: LANGUAGE_ID,
    extensions: ['.primrec', '.prf'],
    aliases: ['Primitive Recursive Functions', 'PrimRec'],
  });

  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
    comments: {
      lineComment: '#',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['(', ')'],
      ['{', '}'],
    ],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '{', close: '}' },
      { open: '/*', close: '*/' },
    ],
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '{', close: '}' },
    ],
  });

  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
    defaultToken: '',
    tokenPostfix: '.primrec',
    builtins: ['zero', 'succ'],
    keywords: ['primrec', 'post', 'forall', 'exists', 'let', 'in', 'true', 'false'],
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/\bsmt\b(?=\s*\{)/, 'keyword.smt', '@smt'],
        [/\s+/, ''],
        [/\b[0-9]+[A-Za-z_][A-Za-z0-9_]*\b/, 'invalid'],
        [/\bpost\b/, 'keyword.postcondition'],
        [/\b(forall|exists)\b/, 'postcondition.quantifier'],
        [/\b(let|in|true|false)\b/, 'keyword.postcondition'],
        [/\bprimrec\b(?=\s*\()/, 'keyword.primitive'],
        [/\b(abs|divisible|distinct|ite)\b(?=\s*\()/, 'postcondition.builtin'],
        [/\b(div|mod|xor)\b/, 'postcondition.operator'],
        [/\b(zero|succ)\b(?=\s*\()/, 'function.builtin'],
        [/[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/, 'function.call'],
        [/[A-Za-z_][A-Za-z0-9_]*/, 'variable'],
        [/<=>|=>|->|==|!=|<=|>=|&&|\|\||\*\*|[+\-*<>!=]/, 'operator'],
        [/[(){},;.]/, 'delimiter'],
        [/[0-9]+/, 'number'],
        [/./, 'invalid'],
      ],
      smt: [
        [/\{/, 'delimiter.bracket', '@smtBody'],
        [/\s+/, ''],
        [/./, 'invalid'],
      ],
      smtBody: [
        [/\}/, 'delimiter.bracket', '@popall'],
        [/;.*$/, 'comment'],
        [/[()]/, 'delimiter.parenthesis'],
        [/\b(assert|forall|exists|declare-fun|declare-sort|define-fun|set-logic|check-sat)\b/, 'keyword.smt'],
        [/[+\-*/=<>&|!]+/, 'operator'],
        [/[0-9]+/, 'number'],
        [/[A-Za-z_.$?~!@%^&*+\-=<>/][A-Za-z0-9_.$?~!@%^&*+\-=<>/]*/, 'variable'],
        [/\s+/, ''],
        [/./, 'string'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
    },
  });

  monaco.editor.defineTheme('primrec-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'function.definition', foreground: '4FC1FF', fontStyle: 'bold' },
      { token: 'function.call', foreground: 'DCDCAA' },
      { token: 'function.builtin', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'function.primrec.base', foreground: '9CDCFE' },
      { token: 'function.primrec.step', foreground: 'CE9178' },
      { token: 'parameter.definition', foreground: '9CDCFE' },
      { token: 'variable.reference', foreground: 'D8DEE9' },
      { token: 'keyword.primitive', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'keyword.postcondition', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'keyword.smt', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'postcondition.function', foreground: '4FC1FF', fontStyle: 'bold' },
      { token: 'postcondition.result', foreground: '9CDCFE', fontStyle: 'bold' },
      { token: 'postcondition.quantifier', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'postcondition.operator', foreground: 'D4D4D4' },
      { token: 'postcondition.builtin', foreground: 'DCDCAA' },
      { token: 'variable', foreground: 'D8DEE9' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'number.literal', foreground: 'B5CEA8' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'delimiter', foreground: '808080' },
      { token: 'comment', foreground: '6E7D8F', fontStyle: 'italic' },
      { token: 'invalid', foreground: 'F48771', fontStyle: 'underline' },
    ],
    colors: {
      'editor.background': '#101418',
      'editorLineNumber.foreground': '#5f6b7a',
      'editorLineNumber.activeForeground': '#c8d1dc',
      'editorCursor.foreground': '#f2cc60',
    },
  });

  // Light theme retained from the original frontend, extended with the new
  // postcondition / SMT token colors so highlighting works in both variants.
  monaco.editor.defineTheme('primrec-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'function.definition', foreground: '0451A5', fontStyle: 'bold' },
      { token: 'function.call', foreground: '795E26' },
      { token: 'function.builtin', foreground: 'AF00DB', fontStyle: 'bold' },
      { token: 'function.primrec.base', foreground: '267F99' },
      { token: 'function.primrec.step', foreground: 'B85B14' },
      { token: 'parameter.definition', foreground: '267F99' },
      { token: 'variable.reference', foreground: '555555' },
      { token: 'keyword.primitive', foreground: 'AF00DB', fontStyle: 'bold' },
      { token: 'keyword.postcondition', foreground: 'AF00DB', fontStyle: 'bold' },
      { token: 'keyword.smt', foreground: 'AF00DB', fontStyle: 'bold' },
      { token: 'postcondition.function', foreground: '0451A5', fontStyle: 'bold' },
      { token: 'postcondition.result', foreground: '267F99', fontStyle: 'bold' },
      { token: 'postcondition.quantifier', foreground: 'AF00DB', fontStyle: 'bold' },
      { token: 'postcondition.operator', foreground: '333333' },
      { token: 'postcondition.builtin', foreground: '795E26' },
      { token: 'variable', foreground: '403F53' },
      { token: 'number', foreground: '098658' },
      { token: 'number.literal', foreground: '098658' },
      { token: 'operator', foreground: '333333' },
      { token: 'delimiter', foreground: '8E908C' },
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'invalid', foreground: 'D62828', fontStyle: 'underline' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editorLineNumber.foreground': '#BDBDBD',
      'editorLineNumber.activeForeground': '#6B6B6B',
      'editorCursor.foreground': '#000000',
    },
  });

  monaco.languages.registerDocumentSemanticTokensProvider(LANGUAGE_ID, {
    getLegend() {
      return SEMANTIC_TOKEN_LEGEND;
    },
    provideDocumentSemanticTokens(model) {
      return { data: encodeSemanticTokens(collectSemanticTokens(model.getValue())) };
    },
    releaseDocumentSemanticTokens() {
      return undefined;
    },
  });

  monaco.languages.registerHoverProvider(LANGUAGE_ID, {
    provideHover(model, position) {
      const message = getSemanticHover(
        model.getValue(),
        position.lineNumber,
        position.column,
      );

      return message ? { contents: [{ value: message }] } : null;
    },
  });

  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    triggerCharacters: ['(', ','],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const signatures = getFunctionSignatures(model.getValue());
      const primRecContext = getPrimRecDependencyCompletionContext(
        model.getValue(),
        model.getOffsetAt(position),
      );

      if (primRecContext) {
        return {
          suggestions: getPrimRecDependencyCompletionSignatures(
            signatures,
            primRecContext,
          ).map((signature) => ({
            label: signature.name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: signature.name,
            detail: `${primRecContext.role} candidate: ${signature.name}/${signature.arity}`,
            documentation: `Matches the required ${primRecContext.role} arity for this primrec expression.`,
            range,
          })),
        };
      }

      return {
        suggestions: [
          {
            label: 'zero',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'zero()',
            detail: 'zero() -> natural number',
            documentation: 'Nullary primitive function returning 0.',
            range,
          },
          {
            label: 'succ',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'succ(${1:x})',
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'succ(x) -> natural number',
            documentation: 'Unary successor primitive function.',
            range,
          },
          {
            label: 'primrec',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'primrec(${1:base}, ${2:step})',
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'primrec(base, step)',
            documentation: 'Primitive recursion over the last function argument.',
            range,
          },
          {
            label: 'post',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'post ${1:functionName}(${2:x}) -> ${3:r} {\n  ${3:r} == ${2:x};\n}',
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'post function(args) -> result',
            documentation: 'Adds a PrimRec postcondition block.',
            range,
          },
          ...getPostconditionCompletionItems(monaco, range),
          ...signatures.map((signature) => ({
            label: signature.name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${signature.name}(${signatureParameterSnippet(
              signature.arity,
            )})`,
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: `${signature.name}/${signature.arity}`,
            range,
          })),
        ],
      };
    },
  });

  registered = true;
}

export function updatePrimRecMarkers(
  monaco: MonacoApi,
  model: Monaco.editor.ITextModel | null,
) {
  if (!model) {
    return;
  }

  const parsed = parseCompleteProgram(model.getValue());
  monaco.editor.setModelMarkers(
    model,
    MARKER_OWNER,
    parsed.diagnostics.map((item) => toMarker(monaco, item)),
  );
}

function signatureParameterSnippet(arity: number): string {
  return Array.from({ length: arity }, (_, index) => `\${${index + 1}:x${index + 1}}`).join(', ');
}

function collectSemanticTokens(source: string): SemanticTokenSpan[] {
  const parsed = parseCompleteProgram(source);
  const tokens: SemanticTokenSpan[] = [];

  parsed.primrec.ast.definitions.forEach((definition) => {
    collectDefinitionSemanticTokens(definition, tokens);
  });
  parsed.postconditions.ast.postconditions.forEach((definition) => {
    collectPostconditionSemanticTokens(definition, tokens);
  });

  return tokens.sort((left, right) => {
    if (left.range.start.line !== right.range.start.line) {
      return left.range.start.line - right.range.start.line;
    }

    return left.range.start.column - right.range.start.column;
  });
}

function collectDefinitionSemanticTokens(
  definition: FunctionDefinition,
  tokens: SemanticTokenSpan[],
) {
  tokens.push({ range: definition.nameRange, tokenType: 'function.definition' });

  definition.params.forEach((param) => {
    tokens.push({ range: param.range, tokenType: 'parameter.definition' });
  });

  collectExpressionSemanticTokens(definition.body, tokens);
}

function collectExpressionSemanticTokens(
  expression: Expression,
  tokens: SemanticTokenSpan[],
) {
  switch (expression.kind) {
    case 'Variable':
      tokens.push({ range: expression.range, tokenType: 'variable.reference' });
      return;

    case 'NumberLiteral':
      tokens.push({ range: expression.range, tokenType: 'number.literal' });
      return;

    case 'Call':
      tokens.push({
        range: expression.calleeRange,
        tokenType: isBuiltinFunction(expression.callee)
          ? 'function.builtin'
          : 'function.call',
      });
      expression.args.forEach((arg) => collectExpressionSemanticTokens(arg, tokens));
      return;

    case 'PrimRec':
      tokens.push({
        range: expression.range,
        tokenType: 'keyword.primitive',
        length: 'primrec'.length,
      });
      if (expression.base) {
        tokens.push({
          range: expression.baseRange,
          tokenType: 'function.primrec.base',
        });
      }
      if (expression.step) {
        tokens.push({
          range: expression.stepRange,
          tokenType: 'function.primrec.step',
        });
      }
      return;

    case 'Error':
      return;
  }
}

function encodeSemanticTokens(tokens: SemanticTokenSpan[]): Uint32Array {
  const data: number[] = [];
  let previousLine = 0;
  let previousStart = 0;

  for (const token of tokens) {
    const line = token.range.start.line - 1;
    const start = token.range.start.column - 1;
    const length = token.length ?? token.range.end.column - token.range.start.column;
    const tokenType = SEMANTIC_TOKEN_INDEXES.get(token.tokenType);

    if (
      tokenType === undefined ||
      length <= 0 ||
      token.range.start.line !== token.range.end.line
    ) {
      continue;
    }

    data.push(
      line - previousLine,
      line === previousLine ? start - previousStart : start,
      length,
      tokenType,
      0,
    );

    previousLine = line;
    previousStart = start;
  }

  return new Uint32Array(data);
}

function isBuiltinFunction(name: string): boolean {
  return name === 'zero' || name === 'succ';
}

function toMarker(
  monaco: MonacoApi,
  diagnostic: Diagnostic,
): Monaco.editor.IMarkerData {
  return {
    severity:
      diagnostic.severity === 'warning'
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Error,
    message: diagnostic.message,
    code: diagnostic.code,
    startLineNumber: diagnostic.range.start.line,
    startColumn: diagnostic.range.start.column,
    endLineNumber: diagnostic.range.end.line,
    endColumn: Math.max(
      diagnostic.range.end.column,
      diagnostic.range.start.column + 1,
    ),
  };
}

export { LANGUAGE_ID };
