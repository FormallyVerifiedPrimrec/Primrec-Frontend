// Program analysis for verification.
//
// Wraps `parseCompleteProgram` and exposes exactly the information the UI and
// the pipeline need: the normalized functions (with their dependencies) plus a
// lookup of which functions actually carry a postcondition. This replaces the
// old `NormalizedFunction.postcondition` field, which no longer exists in the
// ported language model (postconditions are parsed as a separate section now).

import {
  parseCompleteProgram,
  type Diagnostic,
  type NormalizedProgram,
  type PostconditionDefinition,
} from '../../primrecLanguage';

export interface VerifiableFunction {
  name: string;
  parameters: string[];
  /** Names of other user-defined functions used in the implementation. */
  dependencies: string[];
  hasPostcondition: boolean;
  /** The verbatim `post ... { ... }` block, if the function has one. */
  postconditionText?: string;
}

export interface ProgramAnalysis {
  program?: NormalizedProgram;
  functions: VerifiableFunction[];
  /** Postcondition AST keyed by the function name it constrains. */
  postconditions: Map<string, PostconditionDefinition>;
  diagnostics: Diagnostic[];
  hasErrors: boolean;
}

export function analyzeProgram(source: string): ProgramAnalysis {
  const parsed = parseCompleteProgram(source);
  const hasErrors = parsed.diagnostics.some((item) => item.severity === 'error');

  const postconditions = new Map<string, PostconditionDefinition>();
  for (const definition of parsed.postconditions.ast.postconditions) {
    // Last definition wins if the user accidentally repeats a function name.
    postconditions.set(definition.functionName, definition);
  }

  const program = parsed.primrec.program;
  const functions: VerifiableFunction[] = (program?.functions ?? []).map((fn) => {
    const postcondition = postconditions.get(fn.name);
    return {
      name: fn.name,
      parameters: fn.parameters,
      dependencies: fn.dependencies,
      hasPostcondition: postcondition !== undefined,
      postconditionText: postcondition
        ? source.slice(postcondition.range.start.offset, postcondition.range.end.offset)
        : undefined,
    };
  });

  return {
    program,
    functions,
    postconditions,
    diagnostics: parsed.diagnostics,
    hasErrors,
  };
}

/** Convenience: names of all functions that are missing a postcondition. */
export function functionsWithoutPostcondition(analysis: ProgramAnalysis): string[] {
  return analysis.functions
    .filter((fn) => !fn.hasPostcondition)
    .map((fn) => fn.name);
}
