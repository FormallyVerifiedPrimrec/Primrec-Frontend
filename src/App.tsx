import { useMemo, useState } from 'react'
import './App.css'
import { useLocalStorageState } from './features/editor/useLocalStorageState'
import { discoverFunctions, type PrimrecFunction } from './features/primrec/functionDiscovery'
import { AppShell } from './features/layout/AppShell'
import { COMPLETION_EXAMPLE } from './primrecLanguage/constants'
import { parsePrimRecProgram } from './primrecLanguage'
import { Dashboard } from './features/challenges/Dashboard'
import type { ViewType, SubmissionResult } from './features/challenges/types'
import { challengeService } from './features/challenges/challengeService'
import { rankedSystem } from './features/challenges/rankedSystem'

const DEFAULT_SOURCE = COMPLETION_EXAMPLE

function App() {
  const [source, setSource] = useLocalStorageState('primrec.source', DEFAULT_SOURCE)
  const [editorFontSize, setEditorFontSize] = useLocalStorageState('primrec.editorFontSize', 14)
  const [selectedName, setSelectedName] = useState<string>('plus')
  const [view, setView] = useState<ViewType>('editor')
  const [currentChallengeId, setCurrentChallengeId] = useState<string | null>(null)
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | undefined>()
  const [postcondition, setPostcondition] = useState<string>('')

  const functions = useMemo(() => discoverFunctions(source), [source])
  const parseResult = useMemo(() => parsePrimRecProgram(source), [source])

  const currentChallenge = useMemo(() => 
    currentChallengeId ? challengeService.getById(currentChallengeId) : undefined
  , [currentChallengeId])

  const handleSolveChallenge = (id: string) => {
    const challenge = challengeService.getById(id)
    if (challenge) {
      setCurrentChallengeId(id)
      setSource(challenge.templateFunc)
      setPostcondition(challenge.postcondition)
      setSubmissionResult(undefined)
      setView('editor')
    }
  }

  const handleSubmit = () => {
    if (currentChallenge) {
      const result = rankedSystem.verifySubmission('currentUser', currentChallenge, source)
      setSubmissionResult(result)
    }
  }

  const handleBackToDashboard = () => {
    setView('dashboard')
    setCurrentChallengeId(null)
    setSubmissionResult(undefined)
    setPostcondition('')
  }

  // Keep selection stable without "fixing" state in an effect.
  const effectiveSelectedName = useMemo(() => {
    if (functions.length === 0) return undefined
    return functions.some((f) => f.name === selectedName) ? selectedName : functions[0].name
  }, [functions, selectedName])

  const selectedFn: PrimrecFunction | undefined = useMemo(() => {
    if (!effectiveSelectedName) return undefined
    return functions.find((f) => f.name === effectiveSelectedName) ?? functions[0]
  }, [functions, effectiveSelectedName])

  return (
    <div className="appRoot">
      <header className="appHeader">
        <div className="headerContainer">
          <div className="brand">Primrec</div>
          <nav className="navLinks">
            <button 
              className={`navBtn ${view === 'editor' && !currentChallengeId ? 'active' : ''}`} 
              onClick={() => { setView('editor'); setCurrentChallengeId(null); setPostcondition(''); }}
            >
              Editor
            </button>
            <button 
              className={`navBtn ${view === 'dashboard' ? 'active' : ''}`} 
              onClick={() => setView('dashboard')}
            >
              Challenges
            </button>
          </nav>
        </div>
      </header>
      
      <main className="appMain">
        {view === 'dashboard' ? (
          <Dashboard onSolve={handleSolveChallenge} />
        ) : (
          <AppShell
            source={source}
            setSource={setSource}
            editorFontSize={editorFontSize}
            setEditorFontSize={setEditorFontSize}
            functions={functions}
            effectiveSelectedName={effectiveSelectedName}
            setSelectedName={setSelectedName}
            selectedFn={selectedFn}
            parseResult={parseResult}
            currentChallenge={currentChallenge}
            submissionResult={submissionResult}
            onSubmit={handleSubmit}
            onBack={handleBackToDashboard}
            postcondition={postcondition}
            setPostcondition={setPostcondition}
          />
        )}
      </main>
    </div>
  )
}

export default App
