/**
 * Where to go after signing in: the `?returnTo=` page when it is a path inside the admin panel, else the dashboard.
 * Refuses other sites (`//host`, `/\host`, `https://…`) so a crafted login link can't send staff elsewhere.
 */
export function adminReturnPath(returnTo: unknown): string {
  if (typeof returnTo !== 'string') return '/admin'
  return /^\/admin(?:[/?#]|$)/.test(returnTo) && !/[\\\s]/.test(returnTo) ? returnTo : '/admin'
}
