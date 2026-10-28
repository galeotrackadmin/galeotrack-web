// Only booleans live here: never form values, account identifiers, or files.
const guards = new Set<symbol>()

export function addUpdateGuard() {
  const token = Symbol('pending-work')
  guards.add(token)
  return () => { guards.delete(token) }
}

export function hasUpdateGuard() {
  return guards.size > 0
}
