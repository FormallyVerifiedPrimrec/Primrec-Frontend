// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

export const HORN_LOGIC_DECLARATION = '(set-logic HORN)';

export const NAT_PREDICATE = 'nat';

export const NAT_DEFINITION = `(define-fun ${NAT_PREDICATE} ((x Int)) Bool
  (>= x 0))`;

export interface HornClauseOptions {
  variables: readonly string[];
  conditions: readonly string[];
  head: string;
  natVariables?: readonly string[];
}

export function renderHornClause(options: HornClauseOptions): string {
  const uniqueVariables = unique(options.variables);
  const quantified = uniqueVariables.map((name) => `(${name} Int)`).join(' ');
  const natVariables = options.natVariables ?? uniqueVariables;
  const body = renderAnd([
    ...unique(natVariables).map((name) => `(${NAT_PREDICATE} ${name})`),
    ...options.conditions,
  ]);

  return `(assert
  (forall (${quantified})
    (=> ${body}
        ${options.head})))`;
}

export function renderAnd(items: readonly string[]): string {
  if (items.length === 0) {
    return 'true';
  }

  if (items.length === 1) {
    return items[0];
  }

  return `(and ${items.join('\n             ')})`;
}

export function relationAtom(name: string, args: readonly string[]): string {
  return `(${name} ${args.join(' ')})`;
}

export function primRecRelationName(name: string): string {
  return `_${name}`;
}

export function freshName(base: string, used: Set<string>): string {
  let candidate = base;
  let index = 1;
  while (used.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

export function renderRawSmtBlock(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function unique(items: readonly string[]): string[] {
  return [...new Set(items)];
}