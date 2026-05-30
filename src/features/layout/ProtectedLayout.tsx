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
  const [helpOpen, setHelpOpen] = useState(false)

  const c = theme.colors.accent

  return (
    <div className="appRoot">
      <header className="appHeader">
        <div className="headerContainer">
          <div className="brandGroup">
            <div className="brand">Primrec</div>
            <button
              className="brandHelpBtn"
              onClick={() => setHelpOpen(true)}
              aria-label="Open Primrec syntax help"
              title="Syntax help"
            >
              ?
            </button>
          </div>
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
      {helpOpen && <PrimrecHelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

function PrimrecHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modalOverlay" onClick={onClose}>
      <section
        className="modalContent primrecHelpModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="primrecHelpTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modalHeader">
          <h3 id="primrecHelpTitle">Primrec syntax</h3>
          <button className="iconBtn" onClick={onClose} aria-label="Close syntax help">
            x
          </button>
        </div>
        <div className="modalBody primrecHelpBody">
          <p>
            Primrec programs define natural-number functions from projections, constants,
            <code>zero()</code>, <code>succ(x)</code>, composition, and primitive recursion.
          </p>
          <pre>{`base(x) = x;
step(x, y, previous) = succ(previous);
plus(x, y) = primrec(base, step);`}</pre>
          <p>
            Add postconditions with <code>post name(args) -&gt; result</code>. Each statement ends
            with <code>;</code> and may use arithmetic, comparisons, <code>&amp;&amp;</code>,
            <code>||</code>, <code>=&gt;</code>, quantifiers, and calls to your functions.
          </p>
          <pre>{`post plus(x, y) -> r {
  r == x + y;
}`}</pre>
        </div>
      </section>
    </div>
  )
}
