export interface FamilyParentRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FamilyStudentRecord {
  id: string;
  student_id: string | null;
  first_name: string;
  last_name: string;
  class_name: string | null;
  class_id: string | null;
  created_at?: string;
}

export interface FamilyLinkRecord {
  student_id: string;
  guardian_id: string;
  relationship_type: string;
  is_primary_contact: boolean;
}

export interface FamilyClusterParent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  relationships: string[];
  student_count: number;
}

export interface FamilyClusterStudent {
  id: string;
  student_id: string | null;
  name: string;
  class_name: string | null;
}

export interface FamilyCluster {
  family_id: string;
  family_name: string;
  student_count: number;
  parent_count: number;
  parents: FamilyClusterParent[];
  students: FamilyClusterStudent[];
  primary_contacts: FamilyClusterParent[];
  relationship_summary: Record<string, number>;
  last_activity_at: string | null;
}

function normalizeName(firstName: string, lastName: string) {
  return `${firstName || ""} ${lastName || ""}`.trim();
}

function familySortKey(family: FamilyCluster) {
  return `${family.family_name.toLowerCase()}_${family.family_id}`;
}

export function deriveFamilyClusters({
  parents,
  students,
  links,
}: {
  parents: FamilyParentRecord[];
  students: FamilyStudentRecord[];
  links: FamilyLinkRecord[];
}) {
  const parentMap = new Map(parents.map((parent) => [parent.id, parent]));
  const studentMap = new Map(students.map((student) => [student.id, student]));

  const parentToStudents = new Map<string, Set<string>>();
  const studentToParents = new Map<string, Set<string>>();
  const linkLookup = new Map<string, FamilyLinkRecord[]>();

  for (const link of links) {
    if (!parentMap.has(link.guardian_id) || !studentMap.has(link.student_id)) {
      continue;
    }

    if (!parentToStudents.has(link.guardian_id)) {
      parentToStudents.set(link.guardian_id, new Set());
    }
    if (!studentToParents.has(link.student_id)) {
      studentToParents.set(link.student_id, new Set());
    }

    parentToStudents.get(link.guardian_id)!.add(link.student_id);
    studentToParents.get(link.student_id)!.add(link.guardian_id);

    const lookupKey = `${link.guardian_id}:${link.student_id}`;
    const entries = linkLookup.get(lookupKey) || [];
    entries.push(link);
    linkLookup.set(lookupKey, entries);
  }

  const visitedParents = new Set<string>();
  const families: FamilyCluster[] = [];

  for (const parent of parents) {
    const connectedStudents = parentToStudents.get(parent.id);
    if (!connectedStudents || connectedStudents.size === 0 || visitedParents.has(parent.id)) {
      continue;
    }

    const componentParents = new Set<string>();
    const componentStudents = new Set<string>();
    const queue: Array<{ type: "parent" | "student"; id: string }> = [{ type: "parent", id: parent.id }];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.type === "parent") {
        if (componentParents.has(current.id)) continue;
        componentParents.add(current.id);
        visitedParents.add(current.id);

        const linkedStudents = parentToStudents.get(current.id);
        if (!linkedStudents) continue;
        for (const studentId of linkedStudents) {
          if (!componentStudents.has(studentId)) {
            queue.push({ type: "student", id: studentId });
          }
        }
      } else {
        if (componentStudents.has(current.id)) continue;
        componentStudents.add(current.id);

        const linkedParents = studentToParents.get(current.id);
        if (!linkedParents) continue;
        for (const parentId of linkedParents) {
          if (!componentParents.has(parentId)) {
            queue.push({ type: "parent", id: parentId });
          }
        }
      }
    }

    if (componentStudents.size === 0 || componentParents.size === 0) {
      continue;
    }

    const componentParentRecords = Array.from(componentParents)
      .map((id) => parentMap.get(id))
      .filter(Boolean) as FamilyParentRecord[];
    const componentStudentRecords = Array.from(componentStudents)
      .map((id) => studentMap.get(id))
      .filter(Boolean) as FamilyStudentRecord[];

    const parentSummaries = componentParentRecords
      .map((parentRecord) => {
        const studentIds = parentToStudents.get(parentRecord.id) || new Set<string>();
        const relationships = new Set<string>();
        let studentCount = 0;

        for (const studentId of studentIds) {
          if (!componentStudents.has(studentId)) {
            continue;
          }

          studentCount += 1;
          const entries = linkLookup.get(`${parentRecord.id}:${studentId}`) || [];
          for (const entry of entries) {
            relationships.add(entry.relationship_type || "Guardian");
          }
        }

        return {
          id: parentRecord.id,
          name: parentRecord.name,
          email: parentRecord.email,
          phone: parentRecord.phone,
          is_active: parentRecord.is_active,
          relationships: Array.from(relationships),
          student_count: studentCount,
        } satisfies FamilyClusterParent;
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    const relationshipSummary: Record<string, number> = {};
    for (const studentId of componentStudents) {
      const linkedParents = studentToParents.get(studentId);
      if (!linkedParents) continue;
      for (const parentId of linkedParents) {
        const entries = linkLookup.get(`${parentId}:${studentId}`) || [];
        for (const entry of entries) {
          const key = entry.relationship_type || "Guardian";
          relationshipSummary[key] = (relationshipSummary[key] || 0) + 1;
        }
      }
    }

    const primaryContacts = parentSummaries.filter((record) => {
      const studentIds = parentToStudents.get(record.id) || new Set<string>();
      for (const studentId of studentIds) {
        const entries = linkLookup.get(`${record.id}:${studentId}`) || [];
        if (entries.some((entry) => entry.is_primary_contact)) {
          return true;
        }
      }
      return false;
    });

    const familyName = primaryContacts[0]?.name
      || parentSummaries[0]?.name
      || normalizeName(componentStudentRecords[0]?.first_name || "", componentStudentRecords[0]?.last_name || "")
      || "Family";

    const studentItems = componentStudentRecords
      .map((student) => ({
        id: student.id,
        student_id: student.student_id,
        name: normalizeName(student.first_name, student.last_name),
        class_name: student.class_name,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    const lastActivityAt = [
      ...componentParentRecords.map((record) => record.created_at),
      ...componentStudentRecords.map((record) => record.created_at || ""),
    ]
      .filter(Boolean)
      .sort()
      .at(-1) || null;

    families.push({
      family_id: `family_${Array.from(componentParents).sort().at(0) || Array.from(componentStudents).sort().at(0)}`,
      family_name: familyName,
      student_count: componentStudentRecords.length,
      parent_count: componentParentRecords.length,
      parents: parentSummaries,
      students: studentItems,
      primary_contacts: primaryContacts,
      relationship_summary: relationshipSummary,
      last_activity_at: lastActivityAt,
    });
  }

  families.sort((left, right) => familySortKey(left).localeCompare(familySortKey(right)));

  const parentsWithStudents = parents
    .map((parent) => {
      const studentIds = parentToStudents.get(parent.id) || new Set<string>();
      const studentItems = Array.from(studentIds)
        .map((studentId) => studentMap.get(studentId))
        .filter(Boolean) as FamilyStudentRecord[];

      const relationships = new Set<string>();
      for (const studentId of studentIds) {
        const entries = linkLookup.get(`${parent.id}:${studentId}`) || [];
        for (const entry of entries) {
          relationships.add(entry.relationship_type || "Guardian");
        }
      }

      return {
        id: parent.id,
        name: parent.name,
        email: parent.email,
        phone: parent.phone,
        is_active: parent.is_active,
        created_at: parent.created_at,
        student_count: studentItems.length,
        family_count: families.filter((family) => family.parents.some((record) => record.id === parent.id)).length,
        relationships: Array.from(relationships).sort(),
        students: studentItems
          .map((student) => ({
            id: student.id,
            student_id: student.student_id,
            name: normalizeName(student.first_name, student.last_name),
            class_name: student.class_name,
          }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      };
    })
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  return {
    families,
    parents: parentsWithStudents,
  };
}