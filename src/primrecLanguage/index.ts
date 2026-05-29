// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import { parseSyntax } from './primrecParsing/parser';
import { containsPosition } from './primrecParsing/ranges';
import { validateAndNormalize } from './primrecParsing/validation';
import {
  parsePostconditions,
  stripPostconditionSectionsForPrimRec,
  type PostconditionParseResult,
} from './postconditions';
import {
  completeProgramToHornSmt2,
  completeProgramToHornSmt2Parts,
} from './smt2conversion';
import type {
  Expression,
  FunctionDefinition,
  FunctionSignature,
  ParseResult,
  ProgramAst,
} from './types';

export interface CompleteParseResult {
  primrec: ParseResult;
  postconditions: PostconditionParseResult;
  diagnostics: ParseResult['diagnostics'];
}

export function parsePrimRecProgram(source: string): ParseResult {
  const syntax = parseSyntax(stripPostconditionSectionsForPrimRec(source));
  const semantic = validateAndNormalize(syntax.ast);
  const diagnostics = [...syntax.diagnostics, ...semantic.diagnostics];

  return {
    ast: syntax.ast,
    tokens: syntax.tokens,
    diagnostics,
    program: diagnostics.some((item) => item.severity === 'error')
      ? undefined
      : semantic.program,
  };
}

export function parseCompleteProgram(source: string): CompleteParseResult {
  const primrec = parsePrimRecProgram(source);
  const postconditions = parsePostconditions(source, getFunctionSignatures(source));

  return {
    primrec,
    postconditions,
    diagnostics: [...primrec.diagnostics, ...postconditions.diagnostics],
  };
}

export function sourceToHornSmt2Parts(source: string): string[] {
  return completeProgramToHornSmt2Parts(parseCompleteProgram(source));
}

export function sourceToHornSmt2(source: string): string {
  return completeProgramToHornSmt2(parseCompleteProgram(source));
}

export function printToSmt2(source: string): string {
  const smt2 = sourceToHornSmt2(source);
  console.log(smt2);
  return smt2;
}

export function getFunctionSignatures(source: string): FunctionSignature[] {
  const parsed = parseSyntax(stripPostconditionSectionsForPrimRec(source));
  return parsed.ast.definitions.map((definition) => ({
    name: definition.name,
    arity: definition.params.length,
    range: definition.nameRange,
    builtin: false,
  }));
}

export function getSemanticHover(
  source: string,
  line: number,
  column: number,
): string | undefined {
  const parsed = parseSyntax(stripPostconditionSectionsForPrimRec(source));
  const definition = parsed.ast.definitions.find((item) =>
    containsPosition(item.nameRange, line, column),
  );
  if (definition) {
    return formatFunctionHover(definition);
  }

  for (const candidate of parsed.ast.definitions) {
    const param = candidate.params.find((item) =>
      containsPosition(item.range, line, column),
    );
    if (param) {
      return `**Parameter** \`${param.name}\`\n\nScope: \`${candidate.name}\`.`;
    }

    const hover = findExpressionHover(candidate.body, parsed.ast, line, column);
    if (hover) {
      return hover;
    }
  }

  return undefined;
}

function findExpressionHover(
  expression: Expression,
  ast: ProgramAst,
  line: number,
  column: number,
): string | undefined {
  switch (expression.kind) {
    case 'Variable':
      if (containsPosition(expression.range, line, column)) {
        return `**Variable** \`${expression.name}\``;
      }
      return undefined;

    case 'NumberLiteral':
      if (containsPosition(expression.range, line, column)) {
        return `**Natural number literal** \`${expression.raw}\`\n\nPreserved as a numeric constant in the normalized output.`;
      }
      return undefined;

    case 'Call': {
      if (containsPosition(expression.calleeRange, line, column)) {
        const definition = ast.definitions.find(
          (item) => item.name === expression.callee,
        );
        if (definition) {
          return formatFunctionHover(definition);
        }

        if (expression.callee === 'zero') {
          return '**Built-in** `zero()`\n\nNullary primitive function returning 0.';
        }

        if (expression.callee === 'succ') {
          return '**Built-in** `succ(x)`\n\nUnary successor primitive function.';
        }

        return `**Function call** \`${expression.callee}\``;
      }

      for (const arg of expression.args) {
        const hover = findExpressionHover(arg, ast, line, column);
        if (hover) {
          return hover;
        }
      }
      return undefined;
    }

    case 'PrimRec':
      if (containsPosition(expression.range, line, column)) {
        return `**Primitive recursion**\n\nBase: \`${expression.base}\`, step: \`${expression.step}\`. Recursion is over the last parameter of the function being defined.`;
      }
      return undefined;

    case 'Error':
      return undefined;
  }
}

function formatFunctionHover(definition: FunctionDefinition): string {
  const params = definition.params.map((param) => param.name).join(', ');
  return `**Function** \`${definition.name}(${params})\`\n\nArity: ${definition.params.length}.`;
}

export * from './types';
export {
  recognizeIdiomsInParseResult,
  recognizeIdiomsInProgram,
} from './idioms';
export {
  completeProgramToHornSmt2,
  completeProgramToHornSmt2Parts,
  postconditionProgramToHornSmt2,
  postconditionProgramToHornSmt2Parts,
  primRecProgramToHornSmt2,
  primRecProgramToHornSmt2Parts,
} from './smt2conversion';
export { LANGUAGE_ID } from './constants';
export * from './postconditions';