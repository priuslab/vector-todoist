import { describe, expect, it } from 'vitest'

import { FEATURES, isFeatureEnabled } from './featureFlags'

const expectedFeatures = {
  calendar: 'VITE_FEATURE_CALENDAR',
  telegram: 'VITE_FEATURE_TELEGRAM',
  oracle: 'VITE_FEATURE_ORACLE',
  stripe: 'VITE_FEATURE_STRIPE',
  goalFocus: 'VITE_FEATURE_GOAL_FOCUS',
  pomodoro: 'VITE_FEATURE_POMODORO',
  adaptation: 'VITE_FEATURE_ADAPTATION',
}

describe('FEATURES', () => {
  it('is frozen and contains exactly the supported frontend flags', () => {
    expect(FEATURES).toEqual(expectedFeatures)
    expect(Object.isFrozen(FEATURES)).toBe(true)
  })
})

describe('isFeatureEnabled', () => {
  it('returns false for missing or unrecognized environment flags', () => {
    expect(isFeatureEnabled('VITE_FEATURE_TELEGRAM', {})).toBe(false)
    expect(isFeatureEnabled('VITE_FEATURE_TELEGRAM', { VITE_FEATURE_TELEGRAM: 'enabled' })).toBe(false)
  })

  it('returns true only when an environment flag is true', () => {
    expect(isFeatureEnabled('VITE_FEATURE_TELEGRAM', { VITE_FEATURE_TELEGRAM: 'true' })).toBe(true)
  })

  it('keeps Calendar and Oracle reachable by default in the shipped app', () => {
    expect(isFeatureEnabled(FEATURES.calendar, {})).toBe(true)
    expect(isFeatureEnabled(FEATURES.oracle, {})).toBe(true)
  })

  it.each([true, null, 'TRUE'])('keeps malformed flag value %p disabled', (value) => {
    expect(isFeatureEnabled('VITE_FEATURE_TELEGRAM', { VITE_FEATURE_TELEGRAM: value })).toBe(false)
  })
})
