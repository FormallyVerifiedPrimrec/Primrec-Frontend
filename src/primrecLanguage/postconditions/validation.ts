// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import { diagnostic } from '../primrecParsing/ranges';
import type { Diagnostic, FunctionSignature } from '../types';
import type {
  CallExpression,
  IdentifierNode,
  LetStatement,
  PostExpression,
  PostconditionDefinition,
  PostconditionProgramAst,
  PostconditionStatement,
} from './types';

interface ValidationContext {
  scopes: Map<string, IdentifierNode>[];
  functionSignatures: Map<string, FunctionSignature>;
  diagnostics: Diagnostic[];
}

const BUILTIN_CALL_ARITIES = new Map<string, number | 'atLeastTwo'>([
  ['abs', 1],
  ['divisible', 2],
  ['distinct', 'atLeastTwo'],
]);

export function validatePostconditions(
  ast: PostconditionProgramAst,
  functionSignatures: readonly FunctionSignature[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const signatures = new Map(functionSignatures.map((signature) => [signature.name, signature]));

  ast.postconditions.forEach((postcondition) => {
    validatePostcondition(postcondition, signatures, diagnostics);
  });

  return diagnostics;
}

function validatePostcondition(
  postcondition: PostconditionDefinition,
  functionSignatures: Map<string, FunctionSignature>,
  diagnostics: Diagnostic[],
) {
  const signature = functionSignatures.get(postcondition.functionName);
  if (!signature) {
    diagnostics.push(
      diagnostic(
        'POST_VALIDATION_UNKNOWN_FUNCTION',
        `Postcondition references unknown function '${postcondition.functionName}'.`,
        postcondition.functionNameRange,
      ),
    );
  } else if (postcondition.params.length !== signature.arity) {
    diagnostics.push(
      diagnostic(
        'POST_VALIDATION_ARITY',
        `Postcondition for '${postcondition.functionName}' expects ${signature.arity} parameter(s), but got ${postcondition.params.length}.`,
        postcondition.functionNameRange,
      ),
    );
  }

  const rootScope = new Map<string, IdentifierNode>();
  addUniqueNames([...postcondition.params, postcondition.result], rootScope, diagnostics);

  const context: ValidationContext = {
    scopes: [rootScope],
    functionSignatures,
    diagnostics,
  };

  for (const statement of postcondition.statements) {
    validateStatement(statement, context);
    if (statement.kind === 'LetStatement' && statement.name.name) {
      addUniqueNames([statement.name], rootScope, diagnostics);
    }
  }
}

function validateStatement(
  statement: PostconditionStatement,
  context: ValidationContext,
) {
  switch (statement.kind) {
    case 'FormulaStatement':
      validateExpression(statement.expression, context);
      return;

    case 'LetStatement':
      validateLetStatement(statement, context);
      return;

    case 'RawSmtStatement':
      return;
  }
}

function validateLetStatement(statement: LetStatement, context: ValidationContext) {
  validateExpression(statement.value, context);
}

function validateExpression(expression: PostExpression, context: ValidationContext) {
  switch (expression.kind) {
    case 'IdentifierExpression':
      if (!resolveName(expression.name, context)) {
        context.diagnostics.push(
          diagnostic(
            'POST_VALIDATION_UNKNOWN_VARIABLE',
            `Variable '${expression.name}' is not in scope for this postcondition.`,
            expression.range,
          ),
        );
      }
      return;

    case 'NumberExpression':
      if (!Number.isSafeInteger(expression.value)) {
        context.diagnostics.push(
          diagnostic(
            'POST_VALIDATION_UNSAFE_NUMBER_LITERAL',
            `Numeric literal '${expression.raw}' is too large to evaluate safely.`,
            expression.range,
          ),
        );
      }
      return;

    case 'BooleanExpression':
    case 'RawSmtExpression':
    case 'ErrorExpression':
      return;

    case 'UnaryExpression':
      validateExpression(expression.argument, context);
      return;

    case 'BinaryExpression':
      validateExpression(expression.left, context);
      validateExpression(expression.right, context);
      return;

    case 'CallExpression':
      validateCall(expression, context);
      expression.args.forEach((arg) => validateExpression(arg, context));
      return;

    case 'QuantifierExpression':
      validateQuantifier(expression.variables, () => {
        validateExpression(expression.body, context);
      }, context);
      return;

    case 'IteExpression':
      validateExpression(expression.condition, context);
      validateExpression(expression.thenBranch, context);
      validateExpression(expression.elseBranch, context);
      return;

    case 'LetExpression':
      validateExpression(expression.value, context);
      pushScope(context, [expression.name]);
      validateExpression(expression.body, context);
      popScope(context);
      return;
  }
}

function validateCall(expression: CallExpression, context: ValidationContext) {
  const builtin = BUILTIN_CALL_ARITIES.get(expression.callee);
  if (builtin !== undefined) {
    if (builtin === 'atLeastTwo') {
      if (expression.args.length < 2) {
        context.diagnostics.push(
          diagnostic(
            'POST_VALIDATION_CALL_ARITY',
            `Function '${expression.callee}' expects at least 2 argument(s), but got ${expression.args.length}.`,
            expression.range,
          ),
        );
      }
    } else if (expression.args.length !== builtin) {
      context.diagnostics.push(
        diagnostic(
          'POST_VALIDATION_CALL_ARITY',
          `Function '${expression.callee}' expects ${builtin} argument(s), but got ${expression.args.length}.`,
          expression.range,
        ),
      );
    }

    if (expression.callee === 'divisible') {
      validateDivisible(expression, context);
    }
    return;
  }

  const signature = context.functionSignatures.get(expression.callee);
  if (!signature) {
    context.diagnostics.push(
      diagnostic(
        'POST_VALIDATION_UNKNOWN_FUNCTION',
        `Unknown function '${expression.callee}' in postcondition.`,
        expression.calleeRange,
      ),
    );
    return;
  }

  if (expression.args.length !== signature.arity) {
    context.diagnostics.push(
      diagnostic(
        'POST_VALIDATION_CALL_ARITY',
        `Function '${expression.callee}' expects ${signature.arity} argument(s), but got ${expression.args.length}.`,
        expression.range,
      ),
    );
  }
}

function validateDivisible(expression: CallExpression, context: ValidationContext) {
  const first = expression.args[0];
  if (first?.kind !== 'NumberExpression' || first.value <= 0) {
    context.diagnostics.push(
      diagnostic(
        'POST_VALIDATION_DIVISIBLE_NUMERAL',
        'divisible(n, x) requires a positive numeric literal as its first argument.',
        first?.range ?? expression.range,
      ),
    );
  }
}

function validateQuantifier(
  variables: IdentifierNode[],
  validateBody: () => void,
  context: ValidationContext,
) {
  pushScope(context, variables);
  validateBody();
  popScope(context);
}

function addUniqueNames(
  nodes: readonly IdentifierNode[],
  scope: Map<string, IdentifierNode>,
  diagnostics: Diagnostic[],
) {
  for (const node of nodes) {
    if (!node.name) {
      continue;
    }

    if (scope.has(node.name)) {
      diagnostics.push(
        diagnostic(
          'POST_VALIDATION_DUPLICATE_NAME',
          `Name '${node.name}' is already declared in this postcondition scope.`,
          node.range,
        ),
      );
      continue;
    }

    scope.set(node.name, node);
  }
}

function pushScope(context: ValidationContext, variables: readonly IdentifierNode[]) {
  const scope = new Map<string, IdentifierNode>();
  addUniqueNames(variables, scope, context.diagnostics);
  context.scopes.push(scope);
}

function popScope(context: ValidationContext) {
  context.scopes.pop();
}

function resolveName(name: string, context: ValidationContext): boolean {
  for (let index = context.scopes.length - 1; index >= 0; index -= 1) {
    if (context.scopes[index].has(name)) {
      return true;
    }
  }

  return false;
}