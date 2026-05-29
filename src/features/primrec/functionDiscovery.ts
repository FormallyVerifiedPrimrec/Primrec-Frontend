import { parseSyntax } from '../../primrecLanguage/primrecParsing/parser'
import { stripPostconditionSectionsForPrimRec } from '../../primrecLanguage'

export type PrimrecFunction = {
  name: string
  arity: number
  params: string[]
  location?: { line: number }
  dependencies?: string[]
}

export function discoverFunctions(source: string): PrimrecFunction[] {
  // Postcondition / smt blocks (`post foo { ... }`) are not function
  // definitions. Strip them before parsing so they don't surface as bogus
  // entries (e.g. `post` or stray variables) in the functions list. This
  // mirrors the preprocessing done by parsePrimRecProgram and
  // getFunctionSignatures, keeping discovery consistent with the rest of the
  // language tooling. Masking preserves newlines, so line numbers stay correct.
  const primRecSource = stripPostconditionSectionsForPrimRec(source)
  return parseSyntax(primRecSource).ast.definitions.map((definition) => ({
    name: definition.name,
    arity: definition.params.length,
    params: definition.params.map((param) => param.name),
    location: { line: definition.nameRange.start.line },
  }))
}
