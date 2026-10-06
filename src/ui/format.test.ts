import { describe, expect, it } from 'vitest'
import { formatMoney, hypeStatus, moneyStatus, signed, slug } from './format'

describe('moneyStatus', () => {
  // upkeep 50, with 6 sprint-closes left before the deadline
  it('says COVERED when the cash outlasts the run at current upkeep', () => {
    expect(moneyStatus(500, 50, 6)).toEqual({ label: 'COVERED TO THE DEADLINE', mood: 'good' })
    expect(moneyStatus(301, 50, 6)).toEqual({ label: 'COVERED TO THE DEADLINE', mood: 'good' })
  })

  it('shows the runway when it will run out before the deadline', () => {
    expect(moneyStatus(250, 50, 7)).toEqual({ label: 'RUNWAY 5 SPRINTS', mood: 'neutral' })
  })

  it('warns two sprints out and again one sprint out', () => {
    expect(moneyStatus(100, 50, 7)).toEqual({ label: 'BROKE IN 2 SPRINTS', mood: 'warn' })
    expect(moneyStatus(40, 50, 7)).toEqual({ label: 'BROKE AFTER THIS SPRINT', mood: 'bad' })
  })

  it('says BROKE once the money is gone', () => {
    expect(moneyStatus(0, 50, 3).mood).toBe('bad')
    expect(moneyStatus(-26, 50, 0).label).toBe('BROKE: TEAM UNPAID')
  })

  it('never claims you will go broke after the final sprint, because nothing is charged then', () => {
    expect(moneyStatus(30, 50, 0)).toEqual({ label: 'COVERED TO THE DEADLINE', mood: 'good' })
  })
})

describe('small formatters', () => {
  it('uses a real minus sign and a dollar sign', () => {
    expect(signed(3)).toBe('+3')
    expect(signed(-3)).toBe('−3')
    expect(signed(0)).toBe('0')
    expect(formatMoney(120)).toBe('$120')
    expect(formatMoney(-26)).toBe('−$26')
  })

  it('labels hype from silent to impossible', () => {
    expect(hypeStatus(0).label).toBe('NOBODY KNOWS YET')
    expect(hypeStatus(30).mood).toBe('warn')
    expect(hypeStatus(90).mood).toBe('bad')
  })

  it('makes css-safe slugs', () => {
    expect(slug('LEGENDARY FAILURE')).toBe('legendary-failure')
  })
})
