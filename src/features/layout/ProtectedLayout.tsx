import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { ThemePicker } from '../themes/ThemePicker'
import { useTheme } from '../themes/ThemeContext'
import { ProfileModal } from '../auth/ProfileModal'

export function ProtectedLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useTheme()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const c = theme.colors.accent

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
              className="themeToggleBtn"
              onClick={() => setPickerOpen(true)}
              aria-label="Open theme picker"
              title="Theme"
            >
              <span className="themeToggleSwatch" style={{ background: c }} />
            </button>
            <button
              className="navBtn"
              onClick={() => setProfileOpen(true)}
            >
              Profile
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

      {pickerOpen && <ThemePicker onClose={() => setPickerOpen(false)} />}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
