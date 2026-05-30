// Verify panel: kicks off a formal verification of the selected function and
// shows the dependency tree with a live status per node.
//
// Verification runs in a background worker via `useVerification`; the panel only
// ever has one run in flight (enforced by the shared runner). The run is
// cancellable, and it is aborted automatically when the editor source changes
// (handled inside the hook).

import { useMemo } from 'react';
import type { PrimrecFunction } from '../primrec/functionDiscovery';
import {
  analyzeProgram,
  buildChallengeVerificationSource,
  useVerification,
  type VerificationResult,
  type VerificationStatus,
  type VerifiableFunction,
} from '../verification';

export function VerifyPanel({
  fn,
  source,
  challengePostconditions,
}: {
  fn?: PrimrecFunction;
  source: string;
  /**
   * Fixed postconditions owned by the challenge being solved. They are always
   * checked (and cannot be overridden by the participant) but are held back for
   * functions that do not exist yet — see `buildChallengeVerificationSource`.
   */
  challengePostconditions?: string;
}) {
  const combinedSource = useMemo(
    () => buildChallengeVerificationSource(source, challengePostconditions),
    [source, challengePostconditions],
  );
  const analysis = useMemo(() => analyzeProgram(combinedSource), [combinedSource]);
  const { results, isRunning, error, start, cancel } = useVerification(
    combinedSource,
    fn?.name,
  );

  const byName = useMemo(
    () => new Map(analysis.functions.map((item) => [item.name, item])),
    [analysis],
  );

  const canVerify = !!fn && !analysis.hasErrors && byName.has(fn.name);

  return (
    <section className="panel verifyPanel">
      <div className="panelHeader">
        <div className="panelTitle">Verify</div>
        {fn && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="saveBtn"
              onClick={() => start(fn.name)}
              disabled={!canVerify || isRunning}
              style={{ padding: '2px 8px', fontSize: '12px' }}
            >
              {isRunning ? 'Verifying…' : 'Verify All'}
            </button>
            {isRunning && (
              <button
                className="iconBtn"
                onClick={cancel}
                style={{ padding: '2px 8px', fontSize: '12px' }}
                title="Cancel verification"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      <div className="panelContent">
        {error && (
          <div
            className="integrityWarning"
            style={{ color: 'var(--danger-bright)', fontSize: '12px', marginBottom: '8px' }}
          >
            ⚠ {error}
          </div>
        )}
        {fn && canVerify ? (
          <div className="verificationTree">
            <div className="treeTitle">
              Dependency Tree for <strong>{fn.name}</strong>
            </div>
            <div className="treeRoot">
              <VerificationNode name={fn.name} byName={byName} results={results} isRoot />
            </div>
          </div>
        ) : (
          <div className="empty">
            {fn
              ? 'Selected function is not available (fix errors first).'
              : 'No function selected'}
          </div>
        )}
      </div>
    </section>
  );
}

function VerificationNode({
  name,
  byName,
  results,
  isRoot = false,
}: {
  name: string;
  byName: Map<string, VerifiableFunction>;
  results: Record<string, VerificationResult>;
  isRoot?: boolean;
}) {
  const fnDef = byName.get(name);
  const result = results[name];
  const status = result?.status ?? 'pending';
  const dependencies = fnDef?.dependencies.filter((dep) => byName.has(dep)) ?? [];

  return (
    <div className={`treeNode ${isRoot ? 'root' : ''}`}>
      <div className="nodeInfo">
        <StatusIcon status={status} />
        <span className="nodeName">{name}</span>
        {fnDef && !fnDef.hasPostcondition && (
          <span className="noPost"> (no postcondition)</span>
        )}
      </div>

      {result?.message && status !== 'verified' && (
        <div className="nodeMessage" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {result.message}
        </div>
      )}

      {result?.counterExample && (
        <div className="counterExample">
          <strong>Counter-example:</strong>
          <pre>{result.counterExample}</pre>
        </div>
      )}

      {dependencies.length > 0 && (
        <div className="nodeChildren">
          {dependencies.map((dep) => (
            <VerificationNode key={dep} name={dep} byName={byName} results={results} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: VerificationStatus }) {
  switch (status) {
    case 'verified':
      return <span className="statusIcon success" title="Verified">✅</span>;
    case 'failed':
      return <span className="statusIcon failure" title="Failed">❌</span>;
    case 'dependency-failed':
      return <span className="statusIcon dep-failure" title="Dependency failed">❓</span>;
    case 'verifying':
      return <span className="statusIcon loading" title="Verifying">⏳</span>;
    case 'skipped':
      return <span className="statusIcon skipped" title="Skipped (no postcondition)">➖</span>;
    case 'unknown':
      return <span className="statusIcon unknown" title="Unknown">?</span>;
    case 'error':
      return <span className="statusIcon failure" title="Error">⚠️</span>;
    case 'pending':
    default:
      return <span className="statusIcon unknown" title="Pending">·</span>;
  }
}
