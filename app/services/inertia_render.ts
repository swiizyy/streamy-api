import type { HttpContext } from '@adonisjs/core/http'

/**
 * Typed wrapper for inertia.render that accepts any page name.
 * InertiaPages module augmentation doesn't resolve cleanly with NodeNext
 * subpath exports in TypeScript 6. This helper preserves runtime correctness.
 */
export function renderPage(
  ctx: HttpContext,
  page: string,
  props: Record<string, unknown> = {}
): Promise<string | Record<string, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctx.inertia as any).render(page, props)
}
