import { useState } from 'react';
import type { ParseResult, NormalizedProgram, NormalizedFunction } from '../../primrecLanguage/types';
import type { PrimrecFunction } from '../primrec/functionDiscovery';
import { VerificationService, type VerificationResult, type VerificationStatus } from '../challenges/verificationService';

export function VerifyPanel({
  fn,
  parseResult,
}: {
  fn?: PrimrecFunction;
  parseResult: ParseResult;
}) {
  const [results, setResults] = useState<Record<string, VerificationResult>>({});
  const [verifying, setVerifying] = useState(false);

  const verificationService = VerificationService.getInstance();

  const program = parseResult.program;

  const handleVerify = async () => {
    if (!fn || !program) return;

    setVerifying(true);
    verificationService.reset();
    setResults({});

    await verificationService.verifyFunction(fn.name, program, (name: string, result: VerificationResult) => {
      setResults(prev => ({ ...prev, [name]: result }));
    });

    setVerifying(false);
  };

  return (
    <section className="panel verifyPanel">
      <div className="panelHeader">
        <div className="panelTitle">Verify</div>
        {fn && (
          <button 
            className="saveBtn" 
            onClick={handleVerify} 
            disabled={verifying || !program}
            style={{ padding: '2px 8px', fontSize: '12px' }}
          >
            {verifying ? 'Verifying...' : 'Verify All'}
          </button>
        )}
      </div>

      <div className="panelContent">
        {fn ? (
          <div className="verificationTree">
            <div className="treeTitle">Dependency Tree for <strong>{fn.name}</strong></div>
            <div className="treeRoot">
              <VerificationNode 
                name={fn.name} 
                program={program} 
                results={results} 
                isRoot 
              />
            </div>
          </div>
        ) : (
          <div className="empty">No function selected</div>
        )}
      </div>
    </section>
  );
}

function VerificationNode({ 
  name, 
  program, 
  results,
  isRoot = false 
}: { 
  name: string; 
  program?: NormalizedProgram; 
  results: Record<string, VerificationResult>;
  isRoot?: boolean;
}) {
  const fnDef = program?.functions.find((f: NormalizedFunction) => f.name === name);
  const result = results[name];
  const status = result?.status ?? 'unknown';

  const dependencies = fnDef?.dependencies ?? [];

  return (
    <div className={`treeNode ${isRoot ? 'root' : ''}`}>
      <div className="nodeInfo">
        <StatusIcon status={status} />
        <span className="nodeName">{name}</span>
        {fnDef && !fnDef.postcondition && <span className="noPost"> (no postcondition)</span>}
      </div>
      
      {result?.counterExample && (
        <div className="counterExample">
          <strong>Counter-example:</strong>
          <pre>{result.counterExample}</pre>
        </div>
      )}

      {dependencies.length > 0 && (
        <div className="nodeChildren">
          {dependencies.map((dep: string) => (
            <VerificationNode 
              key={dep} 
              name={dep} 
              program={program} 
              results={results} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: VerificationStatus }) {
  switch (status) {
    case 'verified': return <span className="statusIcon success" title="Verified">✅</span>;
    case 'failed': return <span className="statusIcon failure" title="Failed">❌</span>;
    case 'dependency-failed': return <span className="statusIcon dep-failure" title="Dependency Failed">❓</span>;
    case 'unknown': return <span className="statusIcon unknown" title="Unknown">?</span>;
    case 'verifying': return <span className="statusIcon loading" title="Verifying">⏳</span>;
    default: return null;
  }
}
