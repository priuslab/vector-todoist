export const FEATURES = Object.freeze({
  calendar: 'VITE_FEATURE_CALENDAR',
  telegram: 'VITE_FEATURE_TELEGRAM',
  oracle: 'VITE_FEATURE_ORACLE',
  stripe: 'VITE_FEATURE_STRIPE',
  goalFocus: 'VITE_FEATURE_GOAL_FOCUS',
  pomodoro: 'VITE_FEATURE_POMODORO',
  adaptation: 'VITE_FEATURE_ADAPTATION',
})

export function isFeatureEnabled(name, env = import.meta.env) {
  if ([FEATURES.calendar, FEATURES.oracle].includes(name)) return env?.[name] !== 'false'
  return env?.[name] === 'true'
}
