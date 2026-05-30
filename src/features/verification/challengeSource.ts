// Combining a challenge's fixed postconditions with the participant's code.
//
// When solving a challenge the postconditions are owned by the challenge, shown
// read-only beside the editor, and must always be checked when the participant
// verifies — they cannot be edited or weakened. We achieve that by appending
// them to the participant's source before verification: the analyzer and SMT
// builder resolve postconditions "last definition wins", so an appended
// challenge postcondition overrides any same-named one the participant wrote.
//
// The one subtlety: a participant is usually still building the helper functions
// a challenge postcondition refers to. If we appended a postcondition for a
// function that does not exist yet, the language validator would raise an
// "unknown function" error and block verification of *everything*, including the
// helpers the participant is actively working on. So a challenge postcondition
// is only merged in once the function it constrains is actually defined; until
// then it is held back. The participant keeps full feedback on what they have
// written, and the challenge postcondition starts being enforced automatically
// the moment its target function appears.

import { parseCompleteProgram, parsePostconditionSyntax } from '../../primrecLanguage';

/**
 * Build the source that is actually verified for a challenge participation:
 * `userSource` with the applicable challenge postconditions appended.
 *
 * Returns `userSource` unchanged when there are no challenge postconditions, so
 * the plain (non-challenge) editor and single-function verification behave
 * exactly as before.
 */
export function buildChallengeVerificationSource(
  userSource: string,
  challengePostconditions: string | undefined | null,
): string {
  if (!challengePostconditions || !challengePostconditions.trim()) {
    return userSource;
  }

  const definedFunctions = collectDefinedFunctions(userSource);
  const applicable = selectApplicableSections(challengePostconditions, definedFunctions);

  return applicable ? `${userSource}\n\n${applicable}` : userSource;
}

/** Names of every function the participant has defined in their source. */
function collectDefinedFunctions(userSource: string): ReadonlySet<string> {
  const program = parseCompleteProgram(userSource).primrec.program;
  return new Set((program?.functions ?? []).map((fn) => fn.name));
}

/**
 * Slice out the challenge sections that are safe to merge right now: every
 * `smt { ... }` support block (raw SMT, never tied to a function) plus the
 * `post` blocks whose target function is already defined. The verbatim source
 * text is preserved and the sections are emitted in their original order so any
 * support block keeps coming before the postcondition that relies on it.
 */
function selectApplicableSections(
  challengePostconditions: string,
  definedFunctions: ReadonlySet<string>,
): string {
  const { ast } = parsePostconditionSyntax(challengePostconditions);

  const sections: { offset: number; text: string }[] = [];

  for (const postcondition of ast.postconditions) {
    if (definedFunctions.has(postcondition.functionName)) {
      sections.push(sliceSection(challengePostconditions, postcondition.range));
    }
  }

  for (const smtBlock of ast.smtBlocks) {
    sections.push(sliceSection(challengePostconditions, smtBlock.range));
  }

  return sections
    .sort((a, b) => a.offset - b.offset)
    .map((section) => section.text)
    .join('\n\n');
}

function sliceSection(
  source: string,
  range: { start: { offset: number }; end: { offset: number } },
): { offset: number; text: string } {
  return {
    offset: range.start.offset,
    text: source.slice(range.start.offset, range.end.offset),
  };
}
