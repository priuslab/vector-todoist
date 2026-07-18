import { describe, expect, it } from 'vitest'

import { isFeatureEnabled } from './featureFlags'

describe('isFeatureEnabled', () => {
  it('returns false for missing or unrecognized environment flags', () => {
    expect(isFeatureEnabled('VITE_FEATURE_TELEGRAM', {})).toBe(false)
    expect(isFeatureEnabled('VITE_FEATURE_TELEGRAM', { VITE_FEATURE_TELEGRAM: 'enabled' })).toBe(false)
  })

  it('returns true only when an environment flag is true', () => {
    expect(isFeatureEnabled('VITE_FEATURE_TELEGRAM', { VITE_FEATURE_TELEGRAM: 'true' })).toBe(true)
  })
})
