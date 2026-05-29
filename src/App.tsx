import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import { ThemeProvider } from './features/themes/ThemeContext'
import { Auth } from './features/auth/Auth'
import { ProtectedLayout } from './features/layout/ProtectedLayout'
import { EditorPage } from './features/editor/EditorPage'
import { ChallengesPage } from './features/challenges/ChallengesPage'

function AppContent() {
  const { session, isSupabaseLoading, initError } = useAuth()

  if (initError) {
    return (
      <div className="criticalError">
        <h1>Critical Backend Error</h1>
        <code>{initError}</code>
        <button className="saveBtn" onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  if (isSupabaseLoading) {
    return (
      <div className="loadingScreen">
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

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <div className="appContainer">
            <AppContent />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
