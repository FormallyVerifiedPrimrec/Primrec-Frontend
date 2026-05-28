import { BUILTIN_SIGNATURES, RESERVED_NAMES } from './constants';
import { diagnostic } from './ranges';
import type {
  CallExpression,
  CoreExpression,
  Diagnostic,
  Expression,
  FunctionDefinition,
  FunctionSignature,
  NormalizedFunction,
  NormalizedProgram,
  ProgramAst,
  SourceRange,
} from './types';

interface ValidationContext {
  definition: FunctionDefinition;
  parameterIndexes: Map<string, number>;
  visibleSignatures: Map<string, FunctionSignature>;
  allUserDefinitionIndexes: Map<string, number>;
  diagnostics: Diagnostic[];
}

export function validateAndNormalize(ast: ProgramAst): {
  diagnostics: Diagnostic[];
  program?: NormalizedProgram;
} {
  const diagnostics: Diagnostic[] = [];
  const userDefinitionIndexes = new Map<string, number>();
  const duplicateDefinitions = new Set<string>();

  ast.definitions.forEach((definition, index) => {
    if (RESERVED_NAMES.has(definition.name)) {
      diagnostics.push(
        diagnostic(
          'VALIDATION_RESERVED_FUNCTION_NAME',
          `Reserved name '${definition.name}' cannot be redefined.`,
          definition.nameRange,
        ),
      );
      return;
    }

    if (userDefinitionIndexes.has(definition.name)) {
      duplicateDefinitions.add(definition.name);
      diagnostics.push(
        diagnostic(
          'VALIDATION_DUPLICATE_FUNCTION',
          `Function '${definition.name}' is defined more than once.`,
          definition.nameRange,
        ),
      );
      return;
    }

    userDefinitionIndexes.set(definition.name, index);
  });

  const visibleSignatures = new Map<string, FunctionSignature>([
    ['zero', BUILTIN_SIGNATURES.zero],
    ['succ', BUILTIN_SIGNATURES.succ],
  ]);
  const normalized: NormalizedFunction[] = [];
  const dependencyGraph = new Map<string, string[]>();

  for (const definition of ast.definitions) {
    const parameterIndexes = validateParameters(definition, diagnostics);
    const context: ValidationContext = {
      definition,
      parameterIndexes,
      visibleSignatures,
      allUserDefinitionIndexes: userDefinitionIndexes,
      diagnostics,
    };

    validateExpression(definition.body, context, true);

    if (definition.body.kind === 'PrimRec') {
      validatePrimRecArity(definition, definition.body.base, definition.body.baseRange, diagnostics, visibleSignatures, 'base');
      validatePrimRecArity(definition, definition.body.step, definition.body.stepRange, diagnostics, visibleSignatures, 'step');
    }

    const dependencies = collectDependencies(definition.body);
    dependencyGraph.set(definition.name, dependencies);

    if (!RESERVED_NAMES.has(definition.name) && !duplicateDefinitions.has(definition.name)) {
      visibleSignatures.set(definition.name, {
        name: definition.name,
        arity: definition.params.length,
        range: definition.nameRange,
        builtin: false,
      });
    }

    normalized.push({
      name: definition.name,
      arity: definition.params.length,
      parameters: definition.params.map((param) => param.name),
      expression: normalizeExpression(definition.body, parameterIndexes),
      dependencies,
      range: definition.range,
    });
  }

  validateNoCycles(dependencyGraph, ast, diagnostics);

  if (diagnostics.some((item) => item.severity === 'error')) {
    return { diagnostics };
  }

  const signatures: Record<string, FunctionSignature> = {};
  for (const [name, signature] of visibleSignatures.entries()) {
    signatures[name] = signature;
  }

  return {
    diagnostics,
    program: {
      kind: 'PrimitiveRecursiveProgram',
      functions: normalized,
      signatures,
    },
  };
}

function validateParameters(
  definition: FunctionDefinition,
  diagnostics: Diagnostic[],
): Map<string, number> {
  const parameterIndexes = new Map<string, number>();

  definition.params.forEach((param, index) => {
    if (RESERVED_NAMES.has(param.name)) {
      diagnostics.push(
        diagnostic(
          'VALIDATION_RESERVED_PARAMETER_NAME',
          `Reserved name '${param.name}' cannot be used as a parameter.`,
          param.range,
        ),
      );
    }

    if (parameterIndexes.has(param.name)) {
      diagnostics.push(
        diagnostic(
          'VALIDATION_DUPLICATE_PARAMETER',
          `Parameter '${param.name}' is declared more than once.`,
          param.range,
        ),
      );
      return;
    }

    parameterIndexes.set(param.name, index);
  });

  return parameterIndexes;
}

function validateExpression(
  expression: Expression,
  context: ValidationContext,
  topLevel: boolean,
) {
  switch (expression.kind) {
    case 'Variable':
      if (!context.parameterIndexes.has(expression.name)) {
        context.diagnostics.push(
          diagnostic(
            'VALIDATION_UNKNOWN_VARIABLE',
            `Variable '${expression.name}' is not in scope for '${context.definition.name}'.`,
            expression.range,
          ),
        );
      }
      return;

    case 'NumberLiteral':
      return;

    case 'Call':
      validateCallExpression(expression, context);
      expression.args.forEach((arg) => validateExpression(arg, context, false));
      return;

    case 'PrimRec':
      if (!topLevel) {
        context.diagnostics.push(
          diagnostic(
            'VALIDATION_NESTED_PRIMREC',
            'primrec(base, step) may only be the complete right-hand side of a function definition.',
            expression.range,
          ),
        );
      }
      validateNamedDependency(expression.base, expression.baseRange, context);
      validateNamedDependency(expression.step, expression.stepRange, context);
      return;

    case 'Error':
      return;
  }
}

function validateCallExpression(expression: CallExpression, context: ValidationContext) {
  if (expression.callee === 'primrec') {
    context.diagnostics.push(
      diagnostic(
        'VALIDATION_PRIMREC_CALL',
        'primrec is not a callable function; use primrec(base, step) as a complete function body.',
        expression.calleeRange,
      ),
    );
    return;
  }

  const signature = context.visibleSignatures.get(expression.callee);
  if (!signature) {
    reportUnknownOrForwardReference(expression.callee, expression.calleeRange, context);
    return;
  }

  if (expression.args.length !== signature.arity) {
    context.diagnostics.push(
      diagnostic(
        'VALIDATION_CALL_ARITY',
        `Function '${expression.callee}' expects ${signature.arity} argument(s), but got ${expression.args.length}.`,
        expression.range,
      ),
    );
  }
}

function validateNamedDependency(
  name: string,
  range: SourceRange,
  context: ValidationContext,
) {
  if (!name) {
    return;
  }

  if (name === 'primrec') {
    context.diagnostics.push(
      diagnostic(
        'VALIDATION_PRIMREC_AS_DEPENDENCY',
        'primrec cannot be used as a base or step function.',
        range,
      ),
    );
    return;
  }

  if (!context.visibleSignatures.has(name)) {
    reportUnknownOrForwardReference(name, range, context);
  }
}

function reportUnknownOrForwardReference(
  name: string,
  range: SourceRange,
  context: ValidationContext,
) {
  if (context.allUserDefinitionIndexes.has(name)) {
    context.diagnostics.push(
      diagnostic(
        'VALIDATION_FORWARD_REFERENCE',
        `Function '${name}' must be defined before it is used.`,
        range,
      ),
    );
    return;
  }

  context.diagnostics.push(
    diagnostic(
      'VALIDATION_UNKNOWN_FUNCTION',
      `Function '${name}' is not defined.`,
      range,
    ),
  );
}

function validatePrimRecArity(
  definition: FunctionDefinition,
  dependencyName: string,
  dependencyRange: SourceRange,
  diagnostics: Diagnostic[],
  visibleSignatures: Map<string, FunctionSignature>,
  role: 'base' | 'step',
) {
  const signature = visibleSignatures.get(dependencyName);
  if (!signature) {
    return;
  }

  const expected = role === 'base' ? definition.params.length - 1 : definition.params.length + 1;
  if (expected < 0) {
    diagnostics.push(
      diagnostic(
        'VALIDATION_PRIMREC_ARITY',
        `Primitive recursion function '${definition.name}' must have at least one parameter.`,
        definition.nameRange,
      ),
    );
    return;
  }

  if (signature.arity !== expected) {
    diagnostics.push(
      diagnostic(
        'VALIDATION_PRIMREC_ARITY',
        `The ${role} function '${dependencyName}' must have arity ${expected} for '${definition.name}', but has arity ${signature.arity}.`,
        dependencyRange,
      ),
    );
  }
}

function validateNoCycles(
  graph: Map<string, string[]>,
  ast: ProgramAst,
  diagnostics: Diagnostic[],
) {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(name: string, trail: string[]) {
    if (visiting.has(name)) {
      const cycle = [...trail.slice(trail.indexOf(name)), name].join(' -> ');
      const definition = ast.definitions.find((item) => item.name === name);
      diagnostics.push(
        diagnostic(
          'VALIDATION_GENERAL_RECURSION',
          `General recursion is not allowed (${cycle}).`,
          definition?.nameRange ?? ast.range,
        ),
      );
      return;
    }

    if (visited.has(name)) {
      return;
    }

    visiting.add(name);
    for (const dependency of graph.get(name) ?? []) {
      if (graph.has(dependency)) {
        visit(dependency, [...trail, dependency]);
      }
    }
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of graph.keys()) {
    visit(name, [name]);
  }
}

function collectDependencies(expression: Expression): string[] {
  const dependencies = new Set<string>();

  function visit(node: Expression) {
    switch (node.kind) {
      case 'Call':
        if (!BUILTIN_SIGNATURES[node.callee as keyof typeof BUILTIN_SIGNATURES]) {
          dependencies.add(node.callee);
        }
        node.args.forEach(visit);
        break;
      case 'PrimRec':
        if (!BUILTIN_SIGNATURES[node.base as keyof typeof BUILTIN_SIGNATURES]) {
          dependencies.add(node.base);
        }
        if (!BUILTIN_SIGNATURES[node.step as keyof typeof BUILTIN_SIGNATURES]) {
          dependencies.add(node.step);
        }
        break;
      default:
        break;
    }
  }

  visit(expression);
  return [...dependencies].filter(Boolean).sort();
}

function normalizeExpression(
  expression: Expression,
  parameterIndexes: Map<string, number>,
): CoreExpression {
  switch (expression.kind) {
    case 'Variable':
      return {
        kind: 'Projection',
        parameter: expression.name,
        index: parameterIndexes.get(expression.name) ?? -1,
      };

    case 'NumberLiteral':
      return normalizeNumber(expression.value);

    case 'Call': {
      const normalizedArgs = expression.args.map((arg) =>
        normalizeExpression(arg, parameterIndexes),
      );
      if (expression.callee === 'zero') {
        return { kind: 'Zero' };
      }
      if (expression.callee === 'succ') {
        return { kind: 'Successor', argument: normalizedArgs[0] ?? { kind: 'Zero' } };
      }
      return {
        kind: 'Composition',
        callee: expression.callee,
        args: normalizedArgs,
      };
    }

    case 'PrimRec':
      return {
        kind: 'PrimitiveRecursion',
        base: expression.base,
        step: expression.step,
      };

    case 'Error':
      return { kind: 'Zero' };
  }
}

function normalizeNumber(value: number): CoreExpression {
  let expression: CoreExpression = { kind: 'Zero' };
  for (let index = 0; index < value; index += 1) {
    expression = { kind: 'Successor', argument: expression };
  }
  return expression;
}
