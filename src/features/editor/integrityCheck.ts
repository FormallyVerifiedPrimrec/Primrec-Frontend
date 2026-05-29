import type { Challenge } from '../challenges/types';
import { parsePrimRecProgram } from '../../primrecLanguage';
import type { FunctionDefinition } from '../../primrecLanguage/types';

export interface IntegrityStatus {
  isValid: boolean;
  missingFunction?: boolean;
  missingPostcondition?: boolean;
  error?: string;
}

export function checkChallengeIntegrity(source: string, challenge: Challenge): IntegrityStatus {
  const parseResult = parsePrimRecProgram(source);
  
  // Try to find the target function. 
  // For now we assume the challenge expects a specific function name.
  // We can extract the name from the templateFunc or postcondition.
  // Let's assume the postcondition starts with the function name like "plus(x, y) = ..."
  const match = challenge.postcondition.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
  const targetName = match ? match[1] : null;

  if (!targetName) return { isValid: true }; // Cannot determine target

  const fnDef = parseResult.ast.definitions.find((d: FunctionDefinition) => d.name === targetName);

  if (!fnDef) {
    return { 
      isValid: false, 
      missingFunction: true, 
      error: `Required function '${targetName}' is missing.` 
    };
  }

  // Check if postcondition is present in the code (in-code postcondition)
  // Or if it matches the challenge postcondition
  if (!fnDef.postcondition) {
    return { 
      isValid: false, 
      missingPostcondition: true, 
      error: `Postcondition for '${targetName}' is missing.` 
    };
  }

  // Optional: check if the postcondition matches exactly what's required
  // if (fnDef.postcondition !== challenge.postcondition) { ... }

  return { isValid: true };
}
