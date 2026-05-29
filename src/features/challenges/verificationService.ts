import type { NormalizedProgram, NormalizedFunction } from '../../primrecLanguage/types';

export type VerificationStatus = 'verified' | 'failed' | 'unknown' | 'dependency-failed' | 'verifying';

export interface VerificationResult {
  status: VerificationStatus;
  message?: string;
  counterExample?: string;
}

export interface FunctionVerificationNode {
  name: string;
  status: VerificationStatus;
  dependencies: string[];
  postcondition?: string;
  result?: VerificationResult;
}

export class VerificationService {
  private static instance: VerificationService;
  private results: Map<string, VerificationResult> = new Map();

  private constructor() {}

  public static getInstance(): VerificationService {
    if (!VerificationService.instance) {
      VerificationService.instance = new VerificationService();
    }
    return VerificationService.instance;
  }

  public async verifyFunction(
    fnName: string,
    program: NormalizedProgram,
    onProgress: (name: string, result: VerificationResult) => void
  ): Promise<VerificationResult> {
    // 1. Get all reachable functions and their maximum distance from root
    const distances = this.computeDistances(fnName, program);
    const maxDist = Math.max(...Array.from(distances.values()), 0);

    // 2. Verify level by level, starting from the furthest (maxDist) down to 0
    for (let dist = maxDist; dist >= 0; dist--) {
      const levelFns = Array.from(distances.entries())
        .filter(([_, d]) => d === dist)
        .map(([name, _]) => name);

      // Verify all functions at this distance in parallel
      await Promise.all(levelFns.map(async (name) => {
        const fn = program.functions.find(f => f.name === name);
        if (!fn) return;

        // Check if any dependencies failed (they must be at dist > current dist)
        const failedDep = fn.dependencies.find(depName => {
          const depRes = this.results.get(depName);
          return depRes?.status === 'failed' || depRes?.status === 'dependency-failed';
        });

        if (failedDep) {
          const result: VerificationResult = { 
            status: 'dependency-failed', 
            message: `Dependent function '${failedDep}' failed to verify.` 
          };
          this.results.set(name, result);
          onProgress(name, result);
          return;
        }

        // Verify this function
        onProgress(name, { status: 'verifying' });
        const result = await this.mockBackendVerify(fn);
        this.results.set(name, result);
        onProgress(name, result);
      }));
    }

    return this.results.get(fnName) || { status: 'unknown' };
  }

  private computeDistances(rootName: string, program: NormalizedProgram): Map<string, number> {
    const distances = new Map<string, number>();

    const traverse = (name: string, currentDist: number) => {
      const prevMax = distances.get(name) ?? -1;
      if (currentDist <= prevMax) return; // Already reached via a longer or equal path

      distances.set(name, currentDist);

      const fn = program.functions.find(f => f.name === name);
      if (!fn) return;

      for (const dep of fn.dependencies) {
        traverse(dep, currentDist + 1);
      }
    };

    traverse(rootName, 0);
    return distances;
  }

  private async mockBackendVerify(fn: NormalizedFunction): Promise<VerificationResult> {
    const pc = fn.postcondition?.toLowerCase() || '';

    // 1. Simulate Timeout
    if (pc.includes('timeout')) {
      await new Promise(resolve => setTimeout(resolve, 4000));
      return { 
        status: 'failed', 
        message: 'Verification timed out after 4.0s' 
      };
    }

    // 2. Normal Delay
    await new Promise(resolve => setTimeout(resolve, 800));

    if (!fn.postcondition) {
      return { status: 'unknown', message: 'No postcondition provided' };
    }

    // 3. Simulate SAT failure
    if (pc.includes('fail')) {
      return { 
        status: 'failed', 
        message: 'Postcondition is NOT satisfied.',
        counterExample: `Counter-example for ${fn.name}:\nInput: ${fn.parameters.map(p => `${p}=0`).join(', ')}\nResult: 1\nExpected: 0`
      };
    }

    // 4. Simulate Unknown result
    if (pc.includes('unknown')) {
      return { 
        status: 'unknown', 
        message: 'Backend could not determine validity.' 
      };
    }

    return { status: 'verified' };
  }

  public reset() {
    this.results.clear();
  }

  public getStatus(fnName: string): VerificationStatus {
    return this.results.get(fnName)?.status ?? 'unknown';
  }

  public getResult(fnName: string): VerificationResult | undefined {
    return this.results.get(fnName);
  }
}
