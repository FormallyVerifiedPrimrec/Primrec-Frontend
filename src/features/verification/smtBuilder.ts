// Per-function SMT-LIB Horn problem generation.
//
// The editor's smt2conversion module emits one big problem for the *whole*
// program. For step-by-step verification we instead want a self-contained
// problem per function: only the target function, the functions it transitively
// depends on, and the functions referenced by its postcondition are declared and
// defined, followed by the violation clauses for *that one* postcondition. This
// keeps each solver query minimal and lets us verify leaves first and walk up
// the dependency tree, sending only what the current step needs.

import {
  parseCompleteProgram,
  recognizeIdiomsInProgram,
  type NormalizedFunction,
  type NormalizedProgram,
  type PostconditionDefinition,
  type PostExpression,
  type RawSmtBlock,
} from '../../primrecLanguage';
import {
  HORN_LOGIC_DECLARATION,
  NAT_DEFINITION,
  renderFunctionDeclaration,
  renderFunctionDefinition,
  renderPostconditionDefinition,
  renderRawSmtBlock,
} from '../../primrecLanguage/smt2conversion';
import { analyzeProgram } from './analysis';

export interface SmtContext {
  /** Idiom-recognized program (matches the editor's whole-program output). */
  program: NormalizedProgram;
  byName: Map<string, NormalizedFunction>;
  postconditions: Map<string, PostconditionDefinition>;
  /** Global `smt { ... }` blocks shared by every query. */
  smtBlocks: RawSmtBlock[];
}

/**
 * Parse `source` and prepare a reusable context. Throws if the program does not
 * parse cleanly — callers should check diagnostics before verifying.
 */
export function prepareSmtContext(source: string): SmtContext {
  const analysis = analyzeProgram(source);
  if (analysis.hasErrors || !analysis.program) {
    throw new Error('Cannot build SMT for a program with errors.');
  }

  const program = recognizeIdiomsInProgram(analysis.program);
  const byName = new Map(program.functions.map((fn) => [fn.name, fn]));

  // Re-parse only to reach the raw smt blocks; analyzeProgram already parsed,
  // but it does not surface them, so we read them from the postcondition ASTs.
  const smtBlocks = collectSmtBlocks(source);

  return {
    program,
    byName,
    postconditions: analysis.postconditions,
    smtBlocks,
  };
}

/**
 * Build the SMT-LIB Horn problem that checks `targetName`'s postcondition.
 * Returns `null` when the function has no postcondition (nothing to verify).
 */
export function buildFunctionSmt(ctx: SmtContext, targetName: string): string | null {
  const postcondition = ctx.postconditions.get(targetName);
  if (!postcondition) {
    return null;
  }

  const closure = computeClosure(ctx, targetName, postcondition);
  const closureFunctions = ctx.program.functions.filter((fn) =>
    closure.has(fn.name),
  );

  const parts: string[] = [
    HORN_LOGIC_DECLARATION,
    NAT_DEFINITION,
    ...ctx.smtBlocks
      .map((block) => renderRawSmtBlock(block.text))
      .filter((block): block is string => block !== undefined),
    ...closureFunctions.map(renderFunctionDeclaration),
    ...closureFunctions.flatMap(renderFunctionDefinition),
    // Called without a shared support object, so this includes any support
    // declarations (e.g. the power relation) that the postcondition needs.
    ...renderPostconditionDefinition(postcondition),
    '(check-sat)',
  ];

  return parts.join('\n\n');
}

/** One-shot helper for callers that do not keep a context around. */
export function buildFunctionSmtFromSource(
  source: string,
  targetName: string,
): string | null {
  return buildFunctionSmt(prepareSmtContext(source), targetName);
}

/**
 * Functions needed to verify `targetName`: the target itself, everything it
 * transitively depends on (implementation), and everything referenced by its
 * postcondition (plus their dependencies).
 */
function computeClosure(
  ctx: SmtContext,
  targetName: string,
  postcondition: PostconditionDefinition,
): Set<string> {
  const closure = new Set<string>();
  const queue: string[] = [targetName];

  for (const callee of collectPostconditionCalls(postcondition)) {
    if (ctx.byName.has(callee)) {
      queue.push(callee);
    }
  }

  while (queue.length > 0) {
    const name = queue.pop()!;
    if (closure.has(name)) {
      continue;
    }
    const fn = ctx.byName.get(name);
    if (!fn) {
      continue; // builtin (zero/succ) — no declaration needed
    }
    closure.add(name);
    for (const dependency of fn.dependencies) {
      queue.push(dependency);
    }
  }

  return closure;
}

/** Collect every function name a postcondition calls. */
function collectPostconditionCalls(
  definition: PostconditionDefinition,
): Set<string> {
  const calls = new Set<string>();

  const visit = (expression: PostExpression) => {
    switch (expression.kind) {
      case 'CallExpression':
        calls.add(expression.callee);
        expression.args.forEach(visit);
        return;
      case 'UnaryExpression':
        visit(expression.argument);
        return;
      case 'BinaryExpression':
        visit(expression.left);
        visit(expression.right);
        return;
      case 'QuantifierExpression':
        visit(expression.body);
        return;
      case 'IteExpression':
        visit(expression.condition);
        visit(expression.thenBranch);
        visit(expression.elseBranch);
        return;
      case 'LetExpression':
        visit(expression.value);
        visit(expression.body);
        return;
      default:
        return; // identifiers, numbers, booleans, raw smt, errors
    }
  };

  for (const statement of definition.statements) {
    if (statement.kind === 'FormulaStatement') {
      visit(statement.expression);
    } else if (statement.kind === 'LetStatement') {
      visit(statement.value);
    }
  }

  return calls;
}

/** Re-parse to reach the global raw `smt { ... }` blocks. Parsing is cheap. */
function collectSmtBlocks(source: string): RawSmtBlock[] {
  return parseCompleteProgram(source).postconditions.ast.smtBlocks;
}
