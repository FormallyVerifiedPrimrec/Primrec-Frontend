// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import type { Diagnostic, ParseResult } from '../types';
import type { PostconditionParseResult } from '../postconditions';
import {
  primRecProgramToHornSmt2Parts,
} from './primrec';
import {
  postconditionProgramToHornSmt2Parts,
} from './postconditions';

export interface CompleteHornSmt2Input {
  primrec: ParseResult;
  postconditions: PostconditionParseResult;
  diagnostics: readonly Diagnostic[];
}

export function completeProgramToHornSmt2Parts(
  result: CompleteHornSmt2Input,
): string[] {
  if (result.diagnostics.some((item) => item.severity === 'error')) {
    throw new Error('Cannot generate Horn SMT-LIB for an invalid complete program.');
  }

  return [
    ...primRecProgramToHornSmt2Parts(result.primrec),
    ...postconditionProgramToHornSmt2Parts(result.postconditions),
  ];
}

export function completeProgramToHornSmt2(result: CompleteHornSmt2Input): string {
  return completeProgramToHornSmt2Parts(result).join('\n\n');
}

export * from './common';
export * from './primrec';
export * from './postconditions';