import { useMemo, useState, useEffect } from 'react'
import './App.css'
import { useLocalStorageState } from './features/editor/useLocalStorageState'
import { discoverFunctions, type PrimrecFunction } from './features/primrec/functionDiscovery'
import { AppShell } from './features/layout/AppShell'
import { COMPLETION_EXAMPLE } from './primrecLanguage/constants'
import { parsePrimRecProgram } from './primrecLanguage'
import { Dashboard } from './features/challenges/Dashboard'
import type { ViewType, SubmissionResult, Challenge } from './features/challenges/types'
import { challengeService } from './features/challenges/challengeService'
import { rankedSystem } from './features/challenges/rankedSystem'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { Auth } from './features/auth/Auth'
import type { Session } from '@supabase/supabase-js'

const DEFAULT_SOURCE = COMPLETION_EXAMPLE

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [isSupabaseLoading, setIsSupabaseLoading] = useState(true)
  const [source, setSource] = useLocalStorageState('primrec.source', DEFAULT_SOURCE)
  const [editorFontSize, setEditorFontSize] = useLocalStorageState('primrec.editorFontSize', 14)
  const [selectedName, setSelectedName] = useState<string>('plus')
  const [view, setView] = useState<ViewType>('editor')
  const [currentChallengeId, setCurrentChallengeId] = useState<string | null>(null)
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | undefined>()
  const [postcondition, setPostcondition] = useState<string>('')

  const functions = useMemo(() => discoverFunctions(source), [source])
  const parseResult = useMemo(() => parsePrimRecProgram(source), [source])

  const [currentChallenge, setCurrentChallenge] = useState<Challenge | undefined>()

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setInitError("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from .env file.")
      setIsSupabaseLoading(false)
      return;
    }

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        setSession(session)
      } catch (err: any) {
        console.error("Supabase init error:", err)
        setInitError(err.message)
      } finally {
        setIsSupabaseLoading(false)
      }
    }

    initSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (currentChallengeId) {
      challengeService.getById(currentChallengeId).then(setCurrentChallenge)
    } else {
      setCurrentChallenge(undefined)
    }
  }, [currentChallengeId])

  const handleSolveChallenge = async (id: string) => {
    const challenge = await challengeService.getById(id)
    if (challenge) {
      setCurrentChallengeId(id)
      setSource(challenge.templateFunc)
      setPostcondition(challenge.postcondition)
      setSubmissionResult(undefined)
      setView('editor')
    }
  }

  const handleSubmit = async () => {
    if (currentChallenge) {
      const result = await rankedSystem.verifySubmission(currentChallenge, source)
      setSubmissionResult(result)
    }
  }

  const handleBackToDashboard = () => {
    setView('dashboard')
    setCurrentChallengeId(null)
    setSubmissionResult(undefined)
    setPostcondition('')
  }

  const effectiveSelectedName = useMemo(() => {
    if (functions.length === 0) return undefined
    return functions.some((f) => f.name === selectedName) ? selectedName : functions[0].name
  }, [functions, selectedName])

  const selectedFn: PrimrecFunction | undefined = useMemo(() => {
    if (!effectiveSelectedName) return undefined
    return functions.find((f) => f.name === effectiveSelectedName) ?? functions[0]
  }, [functions, effectiveSelectedName])

  const isCreator = currentChallenge && session?.user?.id === currentChallenge.creatorId

  return (
    <div className="appContainer" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {initError ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', gap: '20px' }}>
          <h1 style={{ color: '#ff4444' }}>Critical Backend Error</h1>
          <code>{initError}</code>
          <button className="saveBtn" onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : isSupabaseLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)' }}>
          Connecting to Supabase...
        </div>
      ) : !session ? (
        <Auth />
      ) : (
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
                <button 
                  className="navBtn" 
                  onClick={() => supabase.auth.signOut()}
                  style={{ color: '#b42318' }}
                >
                  Logout
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
                isCreator={!!isCreator}
              />
            )}
          </main>
        </div>
      )}
    </div>
  )
}

export default App
