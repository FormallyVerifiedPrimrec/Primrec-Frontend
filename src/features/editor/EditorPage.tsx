import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLocalStorageState } from './useLocalStorageState'
import { discoverFunctions, type PrimrecFunction } from '../primrec/functionDiscovery'
import { parsePrimRecProgram } from '../../primrecLanguage'
import { AppShell } from '../layout/AppShell'
import { challengeService } from '../challenges/challengeService'
import { rankedSystem } from '../challenges/rankedSystem'
import type { SubmissionResult, Challenge } from '../challenges/types'

const DEFAULT_SOURCE = ''

export function EditorPage() {
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
