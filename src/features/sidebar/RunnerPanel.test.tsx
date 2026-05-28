import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parsePrimRecProgram } from '../../primrecLanguage'
import { discoverFunctions } from '../primrec/functionDiscovery'
import { RunnerPanel } from './RunnerPanel'

const source = `plusBase(x) = x;
plusStep(x, y, z) = succ(z);
plus(x, y) = primrec(plusBase, plusStep);`

describe('RunnerPanel', () => {
  it('evaluates automatically once every input has a value', () => {
    const parseResult = parsePrimRecProgram(source)
    const fn = discoverFunctions(source).find((item) => item.name === 'plus')

    render(<RunnerPanel fn={fn} parseResult={parseResult} />)

    const output = screen.getByLabelText('Output')
    expect(output).toHaveTextContent('plus(x=?, y=?) =')

    fireEvent.change(screen.getByLabelText('Input x'), { target: { value: '2' } })
    expect(output).toHaveTextContent('plus(x=2, y=?) =')

    fireEvent.change(screen.getByLabelText('Input y'), { target: { value: '3' } })
    expect(output).toHaveTextContent('plus(x=2, y=3) = 5')

    fireEvent.change(screen.getByLabelText('Input y'), { target: { value: '' } })
    expect(output).toHaveTextContent('plus(x=2, y=?) =')
  })
})
