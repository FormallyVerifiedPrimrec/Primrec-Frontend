// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

interface SourceSection {
  start: number;
  end: number;
}

export function stripPostconditionSectionsForPrimRec(source: string): string {
  return maskSections(source, findPostconditionSections(source));
}

export function findPostconditionSections(source: string): SourceSection[] {
  const sections: SourceSection[] = [];
  let index = 0;

  while (index < source.length) {
    if (startsLineComment(source, index)) {
      index = skipLineComment(source, index);
      continue;
    }

    if (startsBlockComment(source, index)) {
      index = skipBlockComment(source, index);
      continue;
    }

    if (startsIdentifier(source, index, 'post') || startsIdentifier(source, index, 'smt')) {
      const section = readTopLevelBlock(source, index);
      if (section) {
        sections.push(section);
        index = section.end;
        continue;
      }
    }

    index += 1;
  }

  return sections;
}

function maskSections(source: string, sections: readonly SourceSection[]): string {
  if (sections.length === 0) {
    return source;
  }

  const chars = [...source];
  for (const section of sections) {
    for (let index = section.start; index < section.end; index += 1) {
      if (chars[index] !== '\n' && chars[index] !== '\r') {
        chars[index] = ' ';
      }
    }
  }

  return chars.join('');
}

function readTopLevelBlock(source: string, start: number): SourceSection | undefined {
  const open = findNextNonCommentChar(source, start);
  if (open === undefined || source[open] !== '{') {
    return undefined;
  }

  const close = findMatchingBrace(source, open);
  return { start, end: close === undefined ? source.length : close + 1 };
}

function findNextNonCommentChar(source: string, start: number): number | undefined {
  let index = start;
  while (index < source.length) {
    if (startsLineComment(source, index)) {
      index = skipLineComment(source, index);
      continue;
    }

    if (startsBlockComment(source, index)) {
      index = skipBlockComment(source, index);
      continue;
    }

    if (source[index] === '{') {
      return index;
    }

    index += 1;
  }

  return undefined;
}

function findMatchingBrace(source: string, open: number): number | undefined {
  let depth = 0;
  let index = open;

  while (index < source.length) {
    if (startsLineComment(source, index)) {
      index = skipLineComment(source, index);
      continue;
    }

    if (startsBlockComment(source, index)) {
      index = skipBlockComment(source, index);
      continue;
    }

    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }

    index += 1;
  }

  return undefined;
}

function startsIdentifier(source: string, index: number, value: string): boolean {
  if (source.slice(index, index + value.length) !== value) {
    return false;
  }

  const before = source[index - 1] ?? '';
  const after = source[index + value.length] ?? '';
  return !isIdentifierPart(before) && !isIdentifierPart(after);
}

function startsLineComment(source: string, index: number): boolean {
  return source[index] === '#';
}

function startsBlockComment(source: string, index: number): boolean {
  return source[index] === '/' && source[index + 1] === '*';
}

function skipLineComment(source: string, index: number): number {
  while (index < source.length && source[index] !== '\n') {
    index += 1;
  }
  return index;
}

function skipBlockComment(source: string, index: number): number {
  index += 2;
  while (index < source.length) {
    if (source[index] === '*' && source[index + 1] === '/') {
      return index + 2;
    }
    index += 1;
  }
  return index;
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char);
}