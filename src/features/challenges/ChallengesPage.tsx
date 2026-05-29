import { useNavigate } from 'react-router-dom'
import { Dashboard } from './Dashboard'

export function ChallengesPage() {
  const navigate = useNavigate()

  return (
    <Dashboard
      onSolve={(id) => navigate(`/editor/${id}`)}
      onCreate={() => navigate('/editor', { state: { isCreating: true } })}
    />
  )
}
