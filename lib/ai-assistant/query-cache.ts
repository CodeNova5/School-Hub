/**
 * Query Cache
 * Caches frequent AI assistant queries to reduce API calls
 */

export interface CachedQuery {
  question: string;
  schoolId: string;
  userId?: string;
  response: string;
  timestamp: number;
  expiresAt: number;
}

// In-memory cache (use Redis in production for distributed systems)
const queryCache = new Map<string, CachedQuery>();

// Cache configuration
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_CACHE_SIZE = 1000; // Maximum number of cached queries

/**
 * Generate a cache key from question and context
 */
function generateCacheKey(
  question: string,
  schoolId: string,
  userId?: string
): string {
  const normalizedQuestion = question.toLowerCase().trim();
  return `${schoolId}:${userId || 'global'}:${normalizedQuestion}`;
}

/**
 * Get a cached query response
 */
export function getCachedQuery(
  question: string,
  schoolId: string,
  userId?: string
): string | null {
  const key = generateCacheKey(question, schoolId, userId);
  const cached = queryCache.get(key);

  if (!cached) {
    return null;
  }

  // Check if cache has expired
  if (Date.now() > cached.expiresAt) {
    queryCache.delete(key);
    return null;
  }

  return cached.response;
}

/**
 * Cache a query response
 */
export function setCachedQuery(
  question: string,
  schoolId: string,
  response: string,
  userId?: string
): void {
  // Check cache size and evict oldest entries if needed
  if (queryCache.size >= MAX_CACHE_SIZE) {
    evictOldestEntries(Math.floor(MAX_CACHE_SIZE * 0.2)); // Remove 20% oldest
  }

  const key = generateCacheKey(question, schoolId, userId);
  const now = Date.now();

  queryCache.set(key, {
    question,
    schoolId,
    userId,
    response,
    timestamp: now,
    expiresAt: now + CACHE_TTL
  });
}

/**
 * Evict oldest cache entries
 */
function evictOldestEntries(count: number): void {
  const entries = Array.from(queryCache.entries());
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

  for (let i = 0; i < count && i < entries.length; i++) {
    queryCache.delete(entries[i][0]);
  }
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  queryCache.forEach((value, key) => {
    if (now > value.expiresAt) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => queryCache.delete(key));
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  queryCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate?: number;
} {
  return {
    size: queryCache.size,
    maxSize: MAX_CACHE_SIZE
  };
}

/**
 * Invalidate cache for a specific school
 * Useful when school data is updated
 */
export function invalidateSchoolCache(schoolId: string): void {
  const keysToDelete: string[] = [];

  queryCache.forEach((value, key) => {
    if (value.schoolId === schoolId) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => queryCache.delete(key));
}

/**
 * Invalidate cache for a specific user
 * Useful when user-specific data changes
 */
export function invalidateUserCache(schoolId: string, userId: string): void {
  const keysToDelete: string[] = [];

  queryCache.forEach((value, key) => {
    if (value.schoolId === schoolId && value.userId === userId) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => queryCache.delete(key));
}

// Auto-cleanup expired entries every 10 minutes
if (typeof window === 'undefined') {
  // Server-side only
  setInterval(clearExpiredCache, 10 * 60 * 1000);
}
