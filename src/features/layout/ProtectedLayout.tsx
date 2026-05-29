import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabaseClient'

export function ProtectedLayout() {
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
              style={{ color: 'var(--danger)' }}
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
