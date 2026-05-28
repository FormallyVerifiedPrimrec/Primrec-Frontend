import { useMemo, useState } from "react";
import type { ParseResult } from "../../primrecLanguage";
import type { PrimrecFunction } from "../primrec/functionDiscovery";

type PrimrecChildRole = "base" | "step";

type PrimrecParent = {
  name: string;
  base: string;
  step: string;
};

type DisplayFn = {
  name: string;
  arity?: number;
  params?: string[];
  locationLine?: number;
};

function displayOf(
  name: string,
  byName: Map<string, PrimrecFunction>,
  signatures: Record<string, { arity: number }> | undefined,
): DisplayFn {
  const fromList = byName.get(name);
  if (fromList) {
    return {
      name: fromList.name,
      arity: fromList.arity,
      params: fromList.params,
      locationLine: fromList.location?.line,
    };
  }

  const sig = signatures?.[name];
  return sig ? { name, arity: sig.arity } : { name };
}

export function FunctionsPanel({
  functions,
  selectedName,
  onSelect,
  parseResult,
}: {
  functions: PrimrecFunction[];
  selectedName?: string;
  onSelect: (name: string) => void;
  parseResult: ParseResult;
}) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const byName = useMemo(
    () => new Map(functions.map((fn) => [fn.name, fn])),
    [functions],
  );

  const primrecParents = useMemo(() => {
    const parents: PrimrecParent[] = [];
    for (const def of parseResult.ast.definitions) {
      if (def.kind === "FunctionDefinition" && def.body.kind === "PrimRec") {
        parents.push({
          name: def.name,
          base: def.body.base,
          step: def.body.step,
        });
      }
    }
    return parents;
  }, [parseResult.ast.definitions]);

  const { hiddenChildren, parentsByChild, parentNames } = useMemo(() => {
    const hidden = new Set<string>();
    const byChild = new Map<string, Set<string>>();
    const parents = new Set<string>();

    for (const p of primrecParents) {
      parents.add(p.name);
      for (const child of [p.base, p.step]) {
        hidden.add(child);
        const existing = byChild.get(child) ?? new Set<string>();
        existing.add(p.name);
        byChild.set(child, existing);
      }
    }

    return {
      hiddenChildren: hidden,
      parentsByChild: byChild,
      parentNames: parents,
    };
  }, [primrecParents]);

  const forcedExpandedParents = useMemo(() => {
    if (!selectedName) return undefined;
    return parentsByChild.get(selectedName);
  }, [parentsByChild, selectedName]);

  const parentsByName = useMemo(() => {
    const map = new Map<string, PrimrecParent>();
    for (const p of primrecParents) map.set(p.name, p);
    return map;
  }, [primrecParents]);

  const signatures = parseResult.program?.signatures;

  const listModel = useMemo(() => {
    const needle = q.trim().toLowerCase();

    // Keep original definition order.
    const root = functions.filter((fn) => {
      if (!hiddenChildren.has(fn.name)) return true;
      return parentNames.has(fn.name);
    });

    const rows: Array<
      | { kind: "fn"; fn: DisplayFn; parent?: PrimrecParent }
      | {
          kind: "child";
          role: PrimrecChildRole;
          fn: DisplayFn;
          parentName: string;
        }
    > = [];

    for (const fn of root) {
      const parent = parentsByName.get(fn.name);

      const parentDisplay = displayOf(fn.name, byName, signatures);
      const matchesParent =
        !needle || parentDisplay.name.toLowerCase().includes(needle);

      let childMatches: { base: boolean; step: boolean } | null = null;
      if (parent && needle) {
        childMatches = {
          base: parent.base.toLowerCase().includes(needle),
          step: parent.step.toLowerCase().includes(needle),
        };
      }

      const includeParent =
        matchesParent ||
        !!(childMatches && (childMatches.base || childMatches.step));
      if (!includeParent) continue;

      rows.push({ kind: "fn", fn: parentDisplay, parent });

      if (!parent) continue;

      const shouldExpand =
        !!forcedExpandedParents?.has(parent.name) ||
        expanded[parent.name] ||
        (!!needle &&
          !!childMatches &&
          (childMatches.base || childMatches.step));
      if (!shouldExpand) continue;

      const baseDisplay = displayOf(parent.base, byName, signatures);
      const stepDisplay = displayOf(parent.step, byName, signatures);

      if (
        !needle ||
        baseDisplay.name.toLowerCase().includes(needle) ||
        matchesParent
      ) {
        rows.push({
          kind: "child",
          role: "base",
          fn: baseDisplay,
          parentName: parent.name,
        });
      }
      if (
        !needle ||
        stepDisplay.name.toLowerCase().includes(needle) ||
        matchesParent
      ) {
        rows.push({
          kind: "child",
          role: "step",
          fn: stepDisplay,
          parentName: parent.name,
        });
      }
    }

    return rows;
  }, [
    byName,
    expanded,
    forcedExpandedParents,
    functions,
    hiddenChildren,
    parentNames,
    parentsByName,
    q,
    signatures,
  ]);

  return (
    <section className="panel functionsPanel">
      <div className="panelHeader">
        <div className="panelTitle">Functions</div>
        <input
          className="input"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search functions"
        />
      </div>

      <div className="list" role="list">
        {listModel.length === 0 ? (
          <div className="empty">Keine Treffer</div>
        ) : (
          listModel.map((row) => {
            if (row.kind === "child") {
              const active = row.fn.name === selectedName;
              const label = `${row.role}: ${row.fn.name}`;
              return (
                <div
                  key={`${row.parentName}:${row.role}:${row.fn.name}`}
                  className="listItemRow"
                  role="listitem"
                >
                  <span className="disclosureSpacer" aria-hidden="true" />
                  <button
                    className={
                      active ? "listItem active listItem" : "listItem listItem"
                    }
                    onClick={() => onSelect(row.fn.name)}
                    type="button"
                    aria-label={label}
                    title={label}
                  >
                    <div className="listItemMain">
                      <div className="fnName">{label}</div>
                      <div className="fnMeta">
                        {row.fn.params && row.fn.params.length > 0
                          ? `${row.fn.name}(${row.fn.params.join(", ")}) / arity ${row.fn.arity ?? "—"}`
                          : `arity ${row.fn.arity ?? "—"}`}
                      </div>
                    </div>
                    {row.fn.locationLine ? (
                      <div className="fnLoc">L{row.fn.locationLine}</div>
                    ) : null}
                  </button>
                </div>
              );
            }

            const { fn, parent } = row;
            const active = fn.name === selectedName;
            const isExpandable = !!parent;
            const isOpen = !!(
              parent &&
              (expanded[parent.name] || forcedExpandedParents?.has(parent.name))
            );

            return (
              <div key={fn.name} className="listItemRow" role="listitem">
                {isExpandable ? (
                  <button
                    type="button"
                    className="disclosureBtn"
                    aria-label={
                      isOpen ? `Collapse ${fn.name}` : `Expand ${fn.name}`
                    }
                    aria-expanded={isOpen}
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [fn.name]: !prev[fn.name],
                      }))
                    }
                  >
                    {isOpen ? "▾" : "▸"}
                  </button>
                ) : null}

                <button
                  className={active ? "listItem active" : "listItem"}
                  onClick={() => onSelect(fn.name)}
                  type="button"
                >
                  <div className="listItemMain">
                    <div className="fnName">{fn.name}</div>
                    <div className="fnMeta">
                      {fn.params && fn.params.length > 0
                        ? `${fn.name}(${fn.params.join(", ")}) / arity ${fn.arity ?? "—"}`
                        : `arity ${fn.arity ?? "—"}`}
                    </div>
                  </div>
                  {fn.locationLine ? (
                    <div className="fnLoc">L{fn.locationLine}</div>
                  ) : null}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
