/**
 * Where to go after signing in: the `?ke=` page when it is a path inside the admin panel, else the dashboard.
 * Refuses other sites (`//host`, `/\host`, `https://…`) so a crafted login link can't send staff elsewhere.
 */
export function adminReturnPath(ke: unknown): string {
  if (typeof ke !== 'string') return '/admin'
  return /^\/admin(?:[/?#]|$)/.test(ke) && !/[\\\s]/.test(ke) ? ke : '/admin'
}
