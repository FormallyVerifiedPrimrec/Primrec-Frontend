import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../themes/ThemeContext'
import { useLocalStorageState } from './useLocalStorageState'
import { discoverFunctions, type PrimrecFunction } from '../primrec/functionDiscovery'
import { parsePrimRecProgram } from '../../primrecLanguage'
import { AppShell } from '../layout/AppShell'
import { challengeService } from '../challenges/challengeService'
import { rankedSystem } from '../challenges/rankedSystem'
import type { SubmissionResult, Challenge } from '../challenges/types'

const DEFAULT_SOURCE = ''
const CREATE_TEMPLATE = '// Write your suggested solution here\n'

export function EditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const { theme } = useTheme()

  const [source, setSource] = useLocalStorageState('primrec.source', DEFAULT_SOURCE)
  const [editorFontSize, setEditorFontSize] = useLocalStorageState('primrec.editorFontSize', 14)
  const [selectedName, setSelectedName] = useState<string>('plus')
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | undefined>()
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | undefined>()

  const isCreating = location.state?.isCreating ?? false

  const functions = useMemo(() => discoverFunctions(source), [source])
  const parseResult = useMemo(() => parsePrimRecProgram(source), [source])

  useEffect(() => {
    if (id) {
      challengeService.getById(id).then((challenge) => {
        if (challenge) {
          setCurrentChallenge(challenge)
          setSource(challenge.templateFunc)
          setSubmissionResult(undefined)
        }
      })
    } else if (isCreating) {
      setCurrentChallenge(undefined)
      setSource(CREATE_TEMPLATE)
      setSubmissionResult(undefined)
    } else {
      setCurrentChallenge(undefined)
      setSubmissionResult(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isCreating])

  const handleSubmit = async () => {
    if (currentChallenge) {
      const result = await rankedSystem.verifySubmission(currentChallenge, source)
      setSubmissionResult(result)
    }
  }

  const handleBack = () => {
    navigate('/challenges')
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
      isCreating={isCreating}
      submissionResult={submissionResult}
      onSubmit={handleSubmit}
      onBack={handleBack}
      isCreator={!!isCreator}
      themeVariant={theme.variant}
    />
  )
}
