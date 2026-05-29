import { useMemo, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation, Outlet } from 'react-router-dom'
import './App.css'
import { useLocalStorageState } from './features/editor/useLocalStorageState'
import { discoverFunctions, type PrimrecFunction } from './features/primrec/functionDiscovery'
import { AppShell } from './features/layout/AppShell'
import { parsePrimRecProgram } from './primrecLanguage'
import { Dashboard } from './features/challenges/Dashboard'
import type { SubmissionResult, Challenge } from './features/challenges/types'
import { challengeService } from './features/challenges/challengeService'
import { rankedSystem } from './features/challenges/rankedSystem'
import { supabase } from './supabaseClient'
import { Auth } from './features/auth/Auth'
import { AuthProvider, useAuth } from './features/auth/AuthContext'

const DEFAULT_SOURCE = ''

function AppContent() {
  const { session, isSupabaseLoading, initError } = useAuth()

  if (initError) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', gap: '20px' }}>
        <h1 style={{ color: '#ff4444' }}>Critical Backend Error</h1>
        <code>{initError}</code>
        <button className="saveBtn" onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  if (isSupabaseLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)' }}>
        Connecting to Supabase...
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/editor" replace />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/editor/:id" element={<EditorPage />} />
        <Route path="/challenges" element={<ChallengesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/editor" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="appContainer" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <AppContent />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

function ProtectedLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="appRoot">
      <header className="appHeader">
        <div className="headerContainer">
          <div className="brand">Primrec</div>
          <nav className="navLinks">
            <button
              className={`navBtn ${location.pathname.startsWith('/editor') ? 'active' : ''}`}
              onClick={() => navigate('/editor')}
            >
              Editor
            </button>
            <button
              className={`navBtn ${location.pathname.startsWith('/challenges') ? 'active' : ''}`}
              onClick={() => navigate('/challenges')}
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
        <Outlet />
      </main>
    </div>
  )
}

function EditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()

  const [source, setSource] = useLocalStorageState('primrec.source', DEFAULT_SOURCE)
  const [editorFontSize, setEditorFontSize] = useLocalStorageState('primrec.editorFontSize', 14)
  const [selectedName, setSelectedName] = useState<string>('plus')
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | undefined>()
  const [postcondition, setPostcondition] = useState<string>('')
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | undefined>()

  const functions = useMemo(() => discoverFunctions(source), [source])
  const parseResult = useMemo(() => parsePrimRecProgram(source), [source])

  useEffect(() => {
    if (id) {
      challengeService.getById(id).then((challenge) => {
        if (challenge) {
          setCurrentChallenge(challenge)
          setSource(challenge.templateFunc)
          setPostcondition(challenge.postcondition)
          setSubmissionResult(undefined)
        }
      })
    } else {
      setCurrentChallenge(undefined)
      setSubmissionResult(undefined)
      setPostcondition('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleSubmit = async () => {
    if (currentChallenge) {
      const result = await rankedSystem.verifySubmission(currentChallenge, source)
      setSubmissionResult(result)
    }
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
      onBack={() => navigate('/challenges')}
      postcondition={postcondition}
      setPostcondition={setPostcondition}
      isCreator={!!isCreator}
    />
  )
}

function ChallengesPage() {
  const navigate = useNavigate()

  return <Dashboard onSolve={(id) => navigate(`/editor/${id}`)} />
}

export default App
