/**
 * Route Enforcer — DB-driven route-to-feature matching for middleware.
 *
 * Replaces the hardcoded FEATURE_ROUTES, API_FEATURE_ROUTES, and
 * API_EXCLUDED_ROUTES from plan-routes.ts.
 *
 * Routes are fetched from the subscription_feature_routes table via the
 * get_feature_routes() RPC, then cached in-memory with a TTL.
 * This allows the super admin to add/remove route mappings without redeploying.
 */

interface RouteEntry {
  path_pattern: string;
  feature_key: string | null;
  portal: string | null;
  is_api: boolean;
  is_excluded: boolean;
}

let cachedRoutes: RouteEntry[] | null = null;
let lastFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch feature routes from the DB, with in-memory caching.
 * Falls back to an empty array if the DB call fails.
 */
export async function getRoutes(supabase: any): Promise<RouteEntry[]> {
  if (cachedRoutes && Date.now() - lastFetch < CACHE_TTL_MS) {
    return cachedRoutes;
  }

  try {
    const { data, error } = await supabase.rpc("get_feature_routes");
    if (!error && Array.isArray(data)) {
      cachedRoutes = data as RouteEntry[];
      lastFetch = Date.now();
      return cachedRoutes;
    }
  } catch {
    // Silent — fall through to return cached or empty
  }

  // Return stale cache if DB fails (better than blocking requests)
  if (cachedRoutes) return cachedRoutes;

  return [];
}

/**
 * Force refresh the route cache. Useful after super admin updates routes.
 */
export function clearRouteCache(): void {
  cachedRoutes = null;
  lastFetch = 0;
}

// ── Matching Helpers ─────────────────────────────────────────────────────

/**
 * Check if an API path should bypass plan enforcement (webhooks, auth, etc.).
 */
export function isApiPathExcluded(pathname: string, routes: RouteEntry[]): boolean {
  for (const r of routes) {
    if (!r.is_api || !r.is_excluded) continue;
    if (pathname === r.path_pattern || pathname.startsWith(r.path_pattern + "/")) {
      return true;
    }
  }
  return false;
}

/**
 * Find the gated feature associated with an API pathname.
 * Returns null if the path is not a gated API feature (not excluded, has a feature_key).
 */
export function getApiFeatureForPath(
  pathname: string,
  routes: RouteEntry[]
): { feature: string; pathPrefix: string } | null {
  // Routes are already sorted by path_pattern length DESC (longest-first)
  for (const r of routes) {
    if (!r.is_api || r.is_excluded || !r.feature_key) continue;
    if (pathname === r.path_pattern || pathname.startsWith(r.path_pattern + "/")) {
      return { feature: r.feature_key, pathPrefix: r.path_pattern };
    }
  }
  return null;
}

/**
 * Find the gated feature associated with a page pathname for a given portal.
 * Returns null if the path is not a gated page feature.
 */
export function getFeatureForPath(
  pathname: string,
  portal: string,
  routes: RouteEntry[]
): { feature: string; pathPrefix: string } | null {
  // Routes are already sorted by path_pattern length DESC (longest-first)
  for (const r of routes) {
    if (r.is_api || r.is_excluded || !r.feature_key) continue;
    if (r.portal !== portal) continue;
    if (pathname === r.path_pattern || pathname.startsWith(r.path_pattern + "/")) {
      return { feature: r.feature_key, pathPrefix: r.path_pattern };
    }
  }
  return null;
}
