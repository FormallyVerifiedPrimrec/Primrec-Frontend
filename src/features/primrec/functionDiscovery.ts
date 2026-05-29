import { parseSyntax } from '../../primrecLanguage/primrecParsing/parser'

export type PrimrecFunction = {
  name: string
  arity: number
  params: string[]
  location?: { line: number }
  dependencies?: string[]
}

export function discoverFunctions(source: string): PrimrecFunction[] {
  return parseSyntax(source).ast.definitions.map((definition) => ({
    name: definition.name,
    arity: definition.params.length,
    params: definition.params.map((param) => param.name),
    location: { line: definition.nameRange.start.line },
  }))
}
