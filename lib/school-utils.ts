/**
 * Utility functions to add school_id filtering to Supabase queries
 * 
 * Usage:
 *   import { filterBySchool } from '@/lib/school-utils';
 *   
 *   const query = supabase.from('students').select('*');
 *   const filteredQuery = filterBySchool(query, schoolId);
 *   const { data } = await filteredQuery;
 */

export function filterBySchool(query: any, schoolId: string) {
  return query.eq('school_id', schoolId);
}

/**
 * Create multiple filtered queries in parallel
 * 
 * Usage:
 *   const queries = buildSchoolFilteredQueries(schoolId, [
 *     { table: 'students', select: '*' },
 *     { table: 'sessions', select: '*' },
 *   ]);
 */
export function buildSchoolFilteredQueries(
  schoolId: string,
  queriesConfig: Array<{
    table: string;
    select?: string;
    order?: { column: string; ascending: boolean };
  }>
) {
  const { supabase } = require('@/lib/supabase');

  return queriesConfig.map((config) => {
    let query = supabase.from(config.table).select(config.select || '*').eq('school_id', schoolId);

    if (config.order) {
      query = query.order(config.order.column, { ascending: config.order.ascending });
    }

    return query;
  });
}

/**
 * Execute multiple queries filtered by school_id in parallel
 * 
 * Usage:
 *   const [students, sessions, classes] = await executeSchoolFilteredQueries(schoolId, [
 *     { table: 'students', select: '*', order: { column: 'first_name', ascending: true } },
 *     { table: 'sessions', select: '*', order: { column: 'name', ascending: false } },
 *     { table: 'classes', select: '*', order: { column: 'name', ascending: true } },
 *   ]);
 */
export async function executeSchoolFilteredQueries(
  schoolId: string,
  queriesConfig: Array<{
    table: string;
    select?: string;
    order?: { column: string; ascending: boolean };
  }>
) {
  const queries = buildSchoolFilteredQueries(schoolId, queriesConfig);
  return Promise.all(queries);
}
