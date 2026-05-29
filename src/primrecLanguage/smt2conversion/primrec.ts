// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import { recognizeIdiomsInParseResult } from '../idioms';
import type {
  CoreExpression,
  NormalizedFunction,
  ParseResult,
  PrimitiveRecursionIdiom,
} from '../types';
import {
  freshName,
  HORN_LOGIC_DECLARATION,
  NAT_DEFINITION,
  primRecRelationName,
  relationAtom,
  renderHornClause,
} from './common';

export function primRecProgramToHornSmt2Parts(result: ParseResult): string[] {
  const recognized = recognizeIdiomsInParseResult(result);
  const program = recognized.program;
  if (!program) {
    throw new Error('Cannot generate Horn SMT-LIB for an invalid PrimRec program.');
  }

  return [
    HORN_LOGIC_DECLARATION,
    NAT_DEFINITION,
    renderFunctionDeclarations(program.functions),
    ...program.functions.flatMap(renderFunctionDefinition),
  ];
}

export function primRecProgramToHornSmt2(result: ParseResult): string {
  return primRecProgramToHornSmt2Parts(result).join('\n\n');
}

export function renderFunctionDeclarations(
  definitions: readonly NormalizedFunction[],
): string {
  return definitions.map(renderFunctionDeclaration).join('\n');
}

export function renderFunctionDeclaration(definition: NormalizedFunction): string {
  const argumentSorts = Array.from(
    { length: definition.arity + 1 },
    () => 'Int',
  ).join(' ');
  return `(declare-fun ${primRecRelationName(definition.name)} (${argumentSorts}) Bool)`;
}

export function renderFunctionDefinition(definition: NormalizedFunction): string[] {
  if (definition.expression.kind === 'PrimitiveRecursion') {
    return renderPrimitiveRecursionDefinition(definition, definition.expression);
  }

  return [renderExpressionDefinition(definition, definition.expression)];
}

export function renderExpressionDefinition(
  definition: NormalizedFunction,
  expression: CoreExpression,
): string {
  const result = freshName('r', new Set(definition.parameters));
  const builder = new ClauseBuilder([...definition.parameters, result]);
  builder.lowerExpression(expression, definition.parameters, result);

  return renderHornClause({
    variables: [...definition.parameters, result, ...builder.temporaries],
    conditions: builder.conditions,
    head: relationAtom(primRecRelationName(definition.name), [
      ...definition.parameters,
      result,
    ]),
  });
}

export function renderPrimitiveRecursionDefinition(
  definition: NormalizedFunction,
  expression: Extract<CoreExpression, { kind: 'PrimitiveRecursion' }>,
): string[] {
  if (definition.arity < 1) {
    throw new Error(`Primitive recursion '${definition.name}' needs at least one parameter.`);
  }

  if (expression.idiom) {
    return renderPrimitiveRecursionIdiom(definition, expression, expression.idiom);
  }

  return renderGenericPrimitiveRecursion(definition, expression);
}

export function renderGenericPrimitiveRecursion(
  definition: NormalizedFunction,
  expression: Extract<CoreExpression, { kind: 'PrimitiveRecursion' }>,
): string[] {
  const result = freshName('r', new Set(definition.parameters));
  const fixedParameters = definition.parameters.slice(0, -1);
  const counter = definition.parameters[definition.parameters.length - 1];

  const baseBuilder = new ClauseBuilder([...definition.parameters, result]);
  baseBuilder.callNamedFunction(expression.base, fixedParameters, result);
  const baseRule = renderHornClause({
    variables: [...definition.parameters, result, ...baseBuilder.temporaries],
    conditions: [
      `(= ${counter} 0)`,
      ...baseBuilder.conditions,
    ],
    head: relationAtom(primRecRelationName(definition.name), [
      ...definition.parameters,
      result,
    ]),
  });

  const stepBuilder = new ClauseBuilder([...definition.parameters, result]);
  const previousCounter = stepBuilder.freshName('previousCounter');
  const previous = stepBuilder.freshName('previous');
  stepBuilder.conditions.push(`(= ${counter} (+ ${previousCounter} 1))`);
  stepBuilder.conditions.push(
    relationAtom(primRecRelationName(definition.name), [
      ...fixedParameters,
      previousCounter,
      previous,
    ]),
  );
  stepBuilder.callNamedFunction(
    expression.step,
    [...fixedParameters, previousCounter, previous],
    result,
  );
  const stepRule = renderHornClause({
    variables: [...definition.parameters, result, ...stepBuilder.temporaries],
    conditions: stepBuilder.conditions,
    head: relationAtom(primRecRelationName(definition.name), [
      ...definition.parameters,
      result,
    ]),
  });

  return [baseRule, stepRule];
}

export function renderPrimitiveRecursionIdiom(
  definition: NormalizedFunction,
  expression: Extract<CoreExpression, { kind: 'PrimitiveRecursion' }>,
  idiom: PrimitiveRecursionIdiom,
): string[] {
  switch (idiom.kind) {
    case 'Predecessor':
      return renderPredecessorIdiom(definition, expression);

    case 'ConstantAfterFirst':
      return renderConstantAfterFirstIdiom(definition, expression, idiom);

    case 'LinearRecurrence':
      return renderLinearRecurrenceIdiom(definition, expression, idiom);
  }
}

function renderPredecessorIdiom(
  definition: NormalizedFunction,
  expression: Extract<CoreExpression, { kind: 'PrimitiveRecursion' }>,
): string[] {
  const result = freshName('r', new Set(definition.parameters));
  const fixedParameters = definition.parameters.slice(0, -1);
  const counter = definition.parameters[definition.parameters.length - 1];

  const baseBuilder = new ClauseBuilder([...definition.parameters, result]);
  baseBuilder.callNamedFunction(expression.base, fixedParameters, result);
  const baseRule = renderHornClause({
    variables: [...definition.parameters, result, ...baseBuilder.temporaries],
    conditions: [`(= ${counter} 0)`, ...baseBuilder.conditions],
    head: relationAtom(primRecRelationName(definition.name), [
      ...definition.parameters,
      result,
    ]),
  });

  const positiveRule = renderHornClause({
    variables: [...definition.parameters, result],
    conditions: [`(> ${counter} 0)`, `(= ${result} (- ${counter} 1))`],
    head: relationAtom(primRecRelationName(definition.name), [
      ...definition.parameters,
      result,
    ]),
  });

  return [baseRule, positiveRule];
}

function renderConstantAfterFirstIdiom(
  definition: NormalizedFunction,
  expression: Extract<CoreExpression, { kind: 'PrimitiveRecursion' }>,
  idiom: Extract<PrimitiveRecursionIdiom, { kind: 'ConstantAfterFirst' }>,
): string[] {
  const result = freshName('r', new Set(definition.parameters));
  const fixedParameters = definition.parameters.slice(0, -1);
  const counter = definition.parameters[definition.parameters.length - 1];

  const baseBuilder = new ClauseBuilder([...definition.parameters, result]);
  baseBuilder.callNamedFunction(expression.base, fixedParameters, result);
  const baseRule = renderHornClause({
    variables: [...definition.parameters, result, ...baseBuilder.temporaries],
    conditions: [`(= ${counter} 0)`, ...baseBuilder.conditions],
    head: relationAtom(primRecRelationName(definition.name), [
      ...definition.parameters,
      result,
    ]),
  });

  const stepBuilder = new ClauseBuilder([...definition.parameters, result]);
  stepBuilder.conditions.push(`(> ${counter} 0)`);
  stepBuilder.lowerExpression(idiom.expression, definition.parameters, result);
  const afterFirstRule = renderHornClause({
    variables: [...definition.parameters, result, ...stepBuilder.temporaries],
    conditions: stepBuilder.conditions,
    head: relationAtom(primRecRelationName(definition.name), [
      ...definition.parameters,
      result,
    ]),
  });

  return [baseRule, afterFirstRule];
}

function renderLinearRecurrenceIdiom(
  definition: NormalizedFunction,
  expression: Extract<CoreExpression, { kind: 'PrimitiveRecursion' }>,
  idiom: Extract<PrimitiveRecursionIdiom, { kind: 'LinearRecurrence' }>,
): string[] {
  const result = freshName('r', new Set(definition.parameters));
  const fixedParameters = definition.parameters.slice(0, -1);
  const counter = definition.parameters[definition.parameters.length - 1];
  const builder = new ClauseBuilder([...definition.parameters, result]);
  const baseResult = builder.freshName('baseResult');
  const increment = builder.freshName('increment');

  builder.callNamedFunction(expression.base, fixedParameters, baseResult);
  builder.lowerExpression(idiom.increment, definition.parameters, increment);
  builder.conditions.push(`(= ${result} (+ ${baseResult} (* ${counter} ${increment})))`);

  return [
    renderHornClause({
      variables: [...definition.parameters, result, ...builder.temporaries],
      conditions: builder.conditions,
      head: relationAtom(primRecRelationName(definition.name), [
        ...definition.parameters,
        result,
      ]),
    }),
  ];
}

class ClauseBuilder {
  readonly conditions: string[] = [];
  readonly temporaries: string[] = [];

  private readonly used: Set<string>;

  constructor(usedNames: readonly string[]) {
    this.used = new Set(usedNames);
  }

  freshName(base: string): string {
    const candidate = freshName(base, this.used);
    this.temporaries.push(candidate);
    return candidate;
  }

  lowerExpression(
    expression: CoreExpression,
    frame: readonly string[],
    result: string,
  ) {
    switch (expression.kind) {
      case 'Projection':
        this.conditions.push(`(= ${result} ${frame[expression.index]})`);
        return;

      case 'Number':
        this.conditions.push(`(= ${result} ${expression.value})`);
        return;

      case 'Zero':
        this.conditions.push(`(= ${result} 0)`);
        return;

      case 'Successor': {
        const argument = this.freshName('succArg');
        this.lowerExpression(expression.argument, frame, argument);
        this.conditions.push(`(= ${result} (+ ${argument} 1))`);
        return;
      }

      case 'Composition': {
        const argumentResults = expression.args.map((arg, index) => {
          const argumentResult = this.freshName(`arg${index}`);
          this.lowerExpression(arg, frame, argumentResult);
          return argumentResult;
        });
        this.callNamedFunction(expression.callee, argumentResults, result);
        return;
      }

      case 'PrimitiveRecursion':
        throw new Error('Nested primitive recursion cannot be lowered as an expression.');
    }
  }

  callNamedFunction(name: string, args: readonly string[], result: string) {
    if (name === 'zero') {
      this.conditions.push(`(= ${result} 0)`);
      return;
    }

    if (name === 'succ') {
      this.conditions.push(`(= ${result} (+ ${args[0]} 1))`);
      return;
    }

    this.conditions.push(relationAtom(primRecRelationName(name), [...args, result]));
  }
}