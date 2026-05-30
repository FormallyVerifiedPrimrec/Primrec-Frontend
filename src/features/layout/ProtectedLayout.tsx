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
          <h3 id="primrecHelpTitle">Primrec reference</h3>
          <button className="iconBtn" onClick={onClose} aria-label="Close syntax help">
            x
          </button>
        </div>
        <div className="modalBody primrecHelpBody">
          <section className="helpSection">
            <h4>Formal model</h4>
            <p>
              A Primrec program defines total functions over natural numbers. Every expression is
              built from projection, constants, the successor function, composition, and primitive
              recursion. The editor accepts only definitions that can be normalized into this
              primitive-recursive core.
            </p>
            <p>
              Function parameters are projections: in <code>f(x, y) = x;</code>, the body is the
              first projection. Numeric literals are natural-number constants. The built-ins are
              <code>zero()</code> for the constant 0 and <code>succ(n)</code> for n + 1.
            </p>
          </section>

          <section className="helpSection">
            <h4>Function definitions</h4>
            <pre>{`name(param1, param2) = expression;

id(x) = x;
one() = succ(zero());
two() = succ(one());
square(x) = mult(x, x);`}</pre>
            <ul>
              <li>Every function definition ends with a semicolon.</li>
              <li>Functions must be defined before they are used; forward references are rejected.</li>
              <li><code>zero</code>, <code>succ</code>, and <code>primrec</code> are reserved names.</li>
              <li>General recursion and dependency cycles are not allowed.</li>
            </ul>
          </section>

          <section className="helpSection">
            <h4>Primitive recursion</h4>
            <p>
              <code>primrec(base, step)</code> defines recursion over the last argument of the
              surrounding function. If <code>f(x1, ..., xk, n) = primrec(base, step);</code>, then
              the meaning is:
            </p>
            <pre>{`f(x1, ..., xk, 0)     = base(x1, ..., xk)
f(x1, ..., xk, n + 1) = step(x1, ..., xk, n, f(x1, ..., xk, n))`}</pre>
            <ul>
              <li><code>primrec(base, step)</code> must be the complete right-hand side.</li>
              <li>The recursive function must have at least one parameter.</li>
              <li>The base function has one argument fewer than the recursive function.</li>
              <li>The step function has one argument more than the recursive function.</li>
              <li>The step function receives the previous result as its last parameter.</li>
            </ul>
          </section>

          <section className="helpSection">
            <h4>Addition example</h4>
            <pre>{`plusBase(x) = x;

plusStep(x, y, previous) =
  succ(previous);

plus(x, y) = primrec(plusBase, plusStep);`}</pre>
            <p>
              Here <code>plus</code> recurses over <code>y</code>. For <code>y = 0</code>, it
              returns <code>plusBase(x)</code>. For the next value, <code>plusStep</code> receives
              <code>x</code>, the previous counter value, and the previous result.
            </p>
          </section>

          <section className="helpSection">
            <h4>Multiplication and predecessor</h4>
            <pre>{`multBase(x) = zero();

multStep(x, y, previous) =
  plus(previous, x);

mult(x, y) = primrec(multBase, multStep);

predBase() = zero();

predStep(y, previous) =
  y;

pred(x) = primrec(predBase, predStep);`}</pre>
          </section>

          <section className="helpSection">
            <h4>Core syntax</h4>
            <div className="syntaxTable" aria-label="Primrec syntax overview">
              <div><code># comment</code></div>
              <div>Line comment.</div>
              <div><code>/* comment */</code></div>
              <div>Block comment.</div>
              <div><code>f()</code></div>
              <div>Function call with zero arguments.</div>
              <div><code>f(a, b)</code></div>
              <div>Function call with arguments.</div>
              <div><code>42</code></div>
              <div>Natural-number literal.</div>
              <div><code>primrec(base, step)</code></div>
              <div>Primitive recursion over the last parameter.</div>
            </div>
          </section>

          <section className="helpSection">
            <h4>Postconditions</h4>
            <p>
              A postcondition states what a function result must satisfy. The header names the
              function, its parameters, and the result variable. Each formula statement inside the
              block ends with a semicolon.
            </p>
            <pre>{`post plus(x, y) -> r {
  r == x + y;
}

post pred(x) -> r {
  x == 0 => r == 0;
  x > 0 => r == x - 1;
}`}</pre>
          </section>

          <section className="helpSection">
            <h4>Postcondition expressions</h4>
            <div className="syntaxTable" aria-label="Postcondition syntax overview">
              <div><code>== != &lt; &lt;= &gt; &gt;=</code></div>
              <div>Comparisons.</div>
              <div><code>+ - * div mod **</code></div>
              <div>Arithmetic operators.</div>
              <div><code>! &amp;&amp; || xor =&gt; &lt;=&gt;</code></div>
              <div>Boolean connectives and implication.</div>
              <div><code>forall x. formula</code></div>
              <div>Universal quantification.</div>
              <div><code>exists x. formula</code></div>
              <div>Existential quantification.</div>
              <div><code>ite(condition, a, b)</code></div>
              <div>If-then-else expression.</div>
              <div><code>let t = value in body</code></div>
              <div>Local expression binding.</div>
              <div><code>let t = value;</code></div>
              <div>Local statement binding inside a postcondition block.</div>
              <div><code>abs(x)</code>, <code>divisible(3, x)</code>, <code>distinct(a, b)</code></div>
              <div>Built-in SMT-style helper calls.</div>
            </div>
          </section>

          <section className="helpSection">
            <h4>Raw SMT escape hatch</h4>
            <p>
              Advanced postconditions can include raw SMT snippets. Use this only when the structured
              postcondition language is not expressive enough.
            </p>
            <pre>{`post even(x) -> r {
  smt {
    (= r (ite (= (mod x 2) 0) 1 0))
  }
}`}</pre>
          </section>
        </div>
      </section>
    </div>
  )
}
