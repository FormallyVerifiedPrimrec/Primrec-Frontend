# Primrec Frontend

Web application for the PrimRec platform — a primitive recursive functions programming environment with challenges, verification, and a leaderboard.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Editor | Monaco Editor |
| Auth | Supabase (JWT-based) |
| Routing | React Router DOM v7 |
| Styling | CSS Custom Properties (theme system) |
| Math | KaTeX (via remark-math / rehype-katex) |
| Testing | Vitest + Testing Library |

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase project (for auth and backend API)
- Running `challenges-backend` (see [primrec-backend](../primrec-backend/README.md))

### Environment Variables

Create a `.env` file in the repository root (the parent directory, as configured in `vite.config.ts`):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_CHALLENGES_API_URL=/api
```

### Development

```bash
npm install
npm run dev        # Start Vite dev server (default: http://localhost:5173)
```

### Build

```bash
npm run build      # TypeScript + Vite production build → dist/
npm run preview    # Preview production build locally
```

### Docker

```bash
# From the parent repository:
docker compose up --build frontend
```

The frontend is served by Caddy on port 80/443 with automatic HTTPS (Let's Encrypt). SPA fallback routes all non-API paths to `index.html`. API requests to `/api/` and `/solver/` are proxied to the respective backends.

## Project Structure

```
src/
├── api/                     # REST API client layer
│   └── challengesApi.ts     # Supabase token injection, typed fetch wrapper
├── features/
│   ├── auth/                # Authentication
│   │   ├── Auth.tsx         # Login / sign-up form
│   │   └── AuthContext.tsx  # Session state provider
│   ├── challenges/          # Challenges feature
│   │   ├── Dashboard.tsx    # Challenge list + leaderboard tabs
│   │   ├── ChallengeCard.tsx # Single challenge card with voting
│   │   ├── ChallengeDetails.tsx
│   │   ├── ChallengesPage.tsx
│   │   ├── CreateChallengeModal.tsx
│   │   ├── Leaderboard.tsx  # Ranked user leaderboard
│   │   ├── Markdown.tsx     # LaTeX-capable markdown renderer
│   │   ├── challengeService.ts
│   │   ├── rankedSystem.ts  # Submission verification engine
│   │   ├── verificationService.ts # Postcondition verifier
│   │   ├── mockData.ts
│   │   └── types.ts         # Challenge, User, SubmissionResult types
│   ├── editor/              # Code editor
│   │   ├── PrimrecEditor.tsx # Monaco wrapper
│   │   ├── InsertButtons.tsx # Function template toolbar
│   │   ├── EditorPage.tsx   # Editor route page
│   │   ├── integrityCheck.ts
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorageState.ts
│   │   └── monaco/          # Monaco language integration
│   │       ├── primRecMonaco.ts     # Language registration, theme, tokens
│   │       └── primRecCompletion.ts # Context-aware autocompletion
│   ├── layout/              # App shell
│   │   ├── AppShell.tsx     # Workspace grid (editor + sidebar)
│   │   ├── EditorPane.tsx   # Left column
│   │   ├── ProtectedLayout.tsx # Auth-gated header + nav
│   │   └── ToolsSidebar.tsx # Right sidebar
│   ├── primrec/             # Function discovery
│   │   └── functionDiscovery.ts
│   ├── sidebar/             # Sidebar panels
│   │   ├── FunctionsPanel.tsx    # Tree-disclosure function list
│   │   ├── RunnerPanel.tsx       # Interactive evaluator
│   │   ├── VerifyPanel.tsx       # Postcondition verification
│   │   └── CreateChallengePanel.tsx # In-editor challenge creation form
│   └── themes/              # Theme system
│       ├── themes.ts        # 12 themes (6 hues × dark/light)
│       ├── ThemeContext.tsx  # Provider, localStorage persistence, OLED toggle
│       └── ThemePicker.tsx  # Modal with color swatches
├── primrecLanguage/         # PrimRec language engine
│   ├── lexer.ts             # Hand-written tokenizer
│   ├── parser.ts            # Recursive-descent parser
│   ├── validation.ts        # Semantic validator (scoping, arity, cycles)
│   ├── interpreter.ts       # Compiling evaluator with idiom recognition
│   ├── types.ts             # AST, Diagnostic, NormalizedProgram types
│   ├── constants.ts         # Reserved names, builtins, example code
│   ├── ranges.ts            # Position/range utilities
│   └── index.ts             # Public API re-exports
├── App.tsx                  # Router setup, auth gating
├── App.css                  # Application styles
├── index.css                # CSS custom properties, global reset
├── main.tsx                 # React entry point
└── supabaseClient.ts        # Supabase client singleton
```

## Routes

| Path | Component | Access |
|---|---|---|
| `/login` | `Auth` | Public |
| `/editor` | `EditorPage` | Authenticated |
| `/editor/:id` | `EditorPage` (with loaded challenge) | Authenticated |
| `/challenges` | `ChallengesPage` (Dashboard) | Authenticated |
| `*` | Redirect to `/login` or `/editor` | — |

## Theme System

12 themes across 6 color hues (blue, green, orange, red, yellow, purple), each with dark and light variants. Colors are generated programmatically from a base hue via `lighten()`/`darken()` utilities. An OLED black toggle is available for dark mode themes. Theme selection persists in `localStorage`.

## Testing

```bash
npm test                # Run all tests
npm test -- --watch     # Watch mode
```

Tests cover the PrimRec language parser, lexer, interpreter, and ranked system verification logic.
