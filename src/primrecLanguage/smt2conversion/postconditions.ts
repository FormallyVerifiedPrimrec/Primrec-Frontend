// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import type {
  FormulaStatement,
  LetStatement,
  PostExpression,
  PostconditionDefinition,
  PostconditionParseResult,
  RawSmtStatement,
} from '../postconditions';
import {
  freshName,
  NAT_PREDICATE,
  primRecRelationName,
  relationAtom,
  renderAnd,
  renderHornClause,
  renderRawSmtBlock,
  unique,
} from './common';

const POWER_RELATION = '__primrec_pow';

interface RenderedPostExpression {
  text: string;
  conditions: string[];
  variables: string[];
  natVariables: string[];
}

interface PostconditionFrame {
  conditions: string[];
  variables: string[];
  natVariables: string[];
}

const BOOLEAN_BINARY_OPERATORS = new Map<string, string>([
  ['&&', 'and'],
  ['||', 'or'],
  ['xor', 'xor'],
  ['=>', '=>'],
  ['<=>', '='],
]);

const ARITHMETIC_BINARY_OPERATORS = new Map<string, string>([
  ['+', '+'],
  ['-', '-'],
  ['*', '*'],
  ['div', 'div'],
  ['mod', 'mod'],
]);

const COMPARISON_BINARY_OPERATORS = new Map<string, string>([
  ['==', '='],
  ['<', '<'],
  ['<=', '<='],
  ['>', '>'],
  ['>=', '>='],
]);

export function postconditionProgramToHornSmt2Parts(
  result: PostconditionParseResult,
): string[] {
  if (result.diagnostics.some((item) => item.severity === 'error')) {
    throw new Error('Cannot generate Horn SMT-LIB for invalid postconditions.');
  }

  const support = new PostconditionSmtSupport();
  const postconditionParts = result.ast.postconditions.flatMap((definition) =>
    renderPostconditionDefinition(definition, support),
  );

  return [
    ...result.ast.smtBlocks
      .map((block) => renderRawSmtBlock(block.text))
      .filter((block): block is string => block !== undefined),
    ...support.renderParts(),
    ...postconditionParts,
  ];
}

export function postconditionProgramToHornSmt2(
  result: PostconditionParseResult,
): string {
  return postconditionProgramToHornSmt2Parts(result).join('\n\n');
}

export function renderPostconditionDefinition(
  definition: PostconditionDefinition,
  support?: PostconditionSmtSupport,
): string[] {
  const localSupport = support ?? new PostconditionSmtSupport();
  const renderer = new PostExpressionRenderer(
    [
      ...definition.params.map((param) => param.name),
      definition.result.name,
    ],
    localSupport,
  );
  const frame: PostconditionFrame = {
    conditions: [],
    variables: [],
    natVariables: [],
  };
  const clauses: string[] = [];

  for (const statement of definition.statements) {
    switch (statement.kind) {
      case 'LetStatement':
        renderStatementLet(statement, renderer, frame);
        break;

      case 'FormulaStatement':
        clauses.push(renderFormulaStatement(definition, statement, renderer, frame));
        break;

      case 'RawSmtStatement':
        clauses.push(renderRawSmtStatement(definition, statement, renderer, frame));
        break;
    }
  }

  return support ? clauses : [...localSupport.renderParts(), ...clauses];
}

function renderStatementLet(
  statement: LetStatement,
  renderer: PostExpressionRenderer,
  frame: PostconditionFrame,
) {
  const value = renderer.render(statement.value);
  renderer.reserve(statement.name.name);
  renderer.bindName(statement.name.name, statement.name.name);
  frame.variables.push(statement.name.name, ...value.variables);
  frame.natVariables.push(...value.natVariables);
  frame.conditions.push(...value.conditions, `(= ${statement.name.name} ${value.text})`);
}

function renderFormulaStatement(
  definition: PostconditionDefinition,
  statement: FormulaStatement,
  renderer: PostExpressionRenderer,
  frame: PostconditionFrame,
): string {
  const rendered = renderer.render(statement.expression);
  return renderPostconditionViolationClause(definition, rendered, frame);
}

function renderRawSmtStatement(
  definition: PostconditionDefinition,
  statement: RawSmtStatement,
  // Raw SMT statements are emitted verbatim, so the expression renderer is not
  // needed here. Prefixed with `_` to satisfy the frontend's noUnusedParameters.
  _renderer: PostExpressionRenderer,
  frame: PostconditionFrame,
): string {
  const text = renderRawSmtBlock(statement.block.text) ?? 'true';
  const rendered: RenderedPostExpression = {
    text,
    conditions: [],
    variables: [],
    natVariables: [],
  };
  return renderPostconditionViolationClause(definition, rendered, frame);
}

function renderPostconditionViolationClause(
  definition: PostconditionDefinition,
  rendered: RenderedPostExpression,
  frame: PostconditionFrame,
): string {
  const params = definition.params.map((param) => param.name);
  const result = definition.result.name;
  const visibleVariables = [...params, result];

  return renderHornClause({
    variables: [
      ...visibleVariables,
      ...frame.variables,
      ...rendered.variables,
    ],
    natVariables: [...visibleVariables, ...frame.natVariables, ...rendered.natVariables],
    conditions: [
      relationAtom(primRecRelationName(definition.functionName), [...params, result]),
      ...frame.conditions,
      ...rendered.conditions,
      `(not ${rendered.text})`,
    ],
    head: 'false',
  });
}

class PostExpressionRenderer {
  private readonly scopes: Map<string, string>[] = [new Map()];
  private readonly used: Set<string>;
  private readonly support: PostconditionSmtSupport;

  constructor(usedNames: readonly string[], support: PostconditionSmtSupport) {
    this.used = new Set(usedNames);
    this.support = support;
    usedNames.forEach((name) => this.bindName(name, name));
  }

  bindName(sourceName: string, smtName: string) {
    if (!sourceName) {
      return;
    }
    this.scopes[this.scopes.length - 1].set(sourceName, smtName);
  }

  reserve(name: string) {
    if (name) {
      this.used.add(name);
    }
  }

  render(expression: PostExpression): RenderedPostExpression {
    switch (expression.kind) {
      case 'IdentifierExpression':
        return expressionResult(this.resolve(expression.name));

      case 'NumberExpression':
        return expressionResult(expression.raw);

      case 'BooleanExpression':
        return expressionResult(expression.value ? 'true' : 'false');

      case 'UnaryExpression':
        return this.renderUnaryExpression(expression);

      case 'BinaryExpression':
        return this.renderBinaryExpression(expression);

      case 'CallExpression':
        return this.renderCallExpression(expression.callee, expression.args);

      case 'QuantifierExpression':
        return this.renderQuantifierExpression(expression);

      case 'IteExpression':
        return this.renderIteExpression(expression);

      case 'LetExpression':
        return this.renderLetExpression(expression);

      case 'RawSmtExpression':
        return expressionResult(renderRawSmtBlock(expression.block.text) ?? 'true');

      case 'ErrorExpression':
        return expressionResult('false');
    }
  }

  private renderUnaryExpression(
    expression: Extract<PostExpression, { kind: 'UnaryExpression' }>,
  ): RenderedPostExpression {
    const argument = this.render(expression.argument);
    const operator = expression.operator === '!' ? 'not' : '-';
    return {
      ...argument,
      text: `(${operator} ${argument.text})`,
    };
  }

  private renderBinaryExpression(
    expression: Extract<PostExpression, { kind: 'BinaryExpression' }>,
  ): RenderedPostExpression {
    const left = this.render(expression.left);
    const right = this.render(expression.right);

    if (expression.operator === '!=') {
      return combineExpressions(
        `(not (= ${left.text} ${right.text}))`,
        left,
        right,
      );
    }

    if (expression.operator === '**') {
      this.support.requirePowerRelation();
      const result = this.fresh('powResult');
      return {
        text: result,
        conditions: [
          ...left.conditions,
          ...right.conditions,
          relationAtom(POWER_RELATION, [left.text, right.text, result]),
        ],
        variables: [...left.variables, ...right.variables, result],
        natVariables: [...left.natVariables, ...right.natVariables, result],
      };
    }

    const operator =
      BOOLEAN_BINARY_OPERATORS.get(expression.operator) ??
      ARITHMETIC_BINARY_OPERATORS.get(expression.operator) ??
      COMPARISON_BINARY_OPERATORS.get(expression.operator);

    if (!operator) {
      throw new Error(`Unsupported postcondition operator '${expression.operator}'.`);
    }

    return combineExpressions(`(${operator} ${left.text} ${right.text})`, left, right);
  }

  private renderCallExpression(
    callee: string,
    args: readonly PostExpression[],
  ): RenderedPostExpression {
    const renderedArgs = args.map((arg) => this.render(arg));

    if (callee === 'abs') {
      return combineExpressions(`(abs ${renderedArgs[0]?.text ?? '0'})`, ...renderedArgs);
    }

    if (callee === 'distinct') {
      return combineExpressions(
        `(distinct ${renderedArgs.map((arg) => arg.text).join(' ')})`,
        ...renderedArgs,
      );
    }

    if (callee === 'divisible') {
      const numeral = renderedArgs[0]?.text ?? '0';
      const value = renderedArgs[1]?.text ?? '0';
      return combineExpressions(`((_ divisible ${numeral}) ${value})`, ...renderedArgs);
    }

    const result = this.fresh('callResult');
    return {
      text: result,
      conditions: [
        ...renderedArgs.flatMap((arg) => arg.conditions),
        relationAtom(primRecRelationName(callee), [
          ...renderedArgs.map((arg) => arg.text),
          result,
        ]),
      ],
      variables: [...renderedArgs.flatMap((arg) => arg.variables), result],
      natVariables: [...renderedArgs.flatMap((arg) => arg.natVariables), result],
    };
  }

  private renderQuantifierExpression(
    expression: Extract<PostExpression, { kind: 'QuantifierExpression' }>,
  ): RenderedPostExpression {
    const quantifiedNames = expression.variables.map((variable) =>
      this.fresh(variable.name || 'q'),
    );

    this.pushScope();
    expression.variables.forEach((variable, index) => {
      this.bindName(variable.name, quantifiedNames[index]);
    });
    const body = this.render(expression.body);
    this.popScope();

    const quantified = quantifiedNames.map((name) => `(${name} Int)`).join(' ');
    const natGuards = quantifiedNames.map((name) => `(${NAT_PREDICATE} ${name})`);
    const bodyFormula = this.wrapExpressionBindings(body);
    const text = expression.quantifier === 'forall'
      ? `(forall (${quantified}) (=> ${renderAnd(natGuards)} ${bodyFormula}))`
      : `(exists (${quantified}) ${renderAnd([...natGuards, bodyFormula])})`;

    return expressionResult(text);
  }

  private renderIteExpression(
    expression: Extract<PostExpression, { kind: 'IteExpression' }>,
  ): RenderedPostExpression {
    const condition = this.render(expression.condition);
    const thenBranch = this.render(expression.thenBranch);
    const elseBranch = this.render(expression.elseBranch);
    return combineExpressions(
      `(ite ${condition.text} ${thenBranch.text} ${elseBranch.text})`,
      condition,
      thenBranch,
      elseBranch,
    );
  }

  private renderLetExpression(
    expression: Extract<PostExpression, { kind: 'LetExpression' }>,
  ): RenderedPostExpression {
    const value = this.render(expression.value);
    const localName = this.fresh(expression.name.name || 'let');

    this.pushScope();
    this.bindName(expression.name.name, localName);
    const body = this.render(expression.body);
    this.popScope();

    return {
      text: body.text,
      conditions: [...value.conditions, `(= ${localName} ${value.text})`, ...body.conditions],
      variables: [...value.variables, localName, ...body.variables],
      natVariables: [...value.natVariables, ...body.natVariables],
    };
  }

  private wrapExpressionBindings(expression: RenderedPostExpression): string {
    if (expression.conditions.length === 0) {
      return expression.text;
    }

    const variables = unique(expression.variables);
    if (variables.length === 0) {
      return renderAnd([...expression.conditions, expression.text]);
    }

    const quantified = variables.map((name) => `(${name} Int)`).join(' ');
    return `(exists (${quantified}) ${renderAnd([
      ...unique(expression.natVariables).map((name) => `(${NAT_PREDICATE} ${name})`),
      ...expression.conditions,
      expression.text,
    ])})`;
  }

  private fresh(base: string): string {
    return freshName(base, this.used);
  }

  private resolve(name: string): string {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const resolved = this.scopes[index].get(name);
      if (resolved) {
        return resolved;
      }
    }
    return name;
  }

  private pushScope() {
    this.scopes.push(new Map());
  }

  private popScope() {
    this.scopes.pop();
  }
}

function expressionResult(text: string): RenderedPostExpression {
  return {
    text,
    conditions: [],
    variables: [],
    natVariables: [],
  };
}

function combineExpressions(
  text: string,
  ...expressions: RenderedPostExpression[]
): RenderedPostExpression {
  return {
    text,
    conditions: expressions.flatMap((expression) => expression.conditions),
    variables: expressions.flatMap((expression) => expression.variables),
    natVariables: expressions.flatMap((expression) => expression.natVariables),
  };
}

class PostconditionSmtSupport {
  private needsPowerRelation = false;

  requirePowerRelation() {
    this.needsPowerRelation = true;
  }

  renderParts(): string[] {
    if (!this.needsPowerRelation) {
      return [];
    }

    return [
      `(declare-fun ${POWER_RELATION} (Int Int Int) Bool)`,
      renderHornClause({
        variables: ['base', 'result'],
        conditions: ['(= result 1)'],
        head: relationAtom(POWER_RELATION, ['base', '0', 'result']),
      }),
      renderHornClause({
        variables: ['base', 'exp', 'previousExp', 'previous', 'result'],
        conditions: [
          '(= exp (+ previousExp 1))',
          relationAtom(POWER_RELATION, ['base', 'previousExp', 'previous']),
          '(= result (* previous base))',
        ],
        head: relationAtom(POWER_RELATION, ['base', 'exp', 'result']),
      }),
    ];
  }
}