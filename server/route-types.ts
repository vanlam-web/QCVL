export type RouteResult = Promise<
  | { found: true; data: unknown; status?: number }
  | { found: false }
>
