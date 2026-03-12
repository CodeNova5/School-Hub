/**
 * Testing the smart mapping implementation
 * This demonstrates how departments and religions are automatically matched
 */

import {
  getSmartDepartmentId,
  getSmartReligionId,
  getSubjectsForLevel,
  isReligionSubject,
} from "./nigerian-subjects";
import { Department, Religion } from "./types";

// Mock school configuration
const mockDepartments: Department[] = [
  { id: "d1", school_id: "s1", name: "Science", code: "SCI", is_active: true, created_at: "" },
  { id: "d2", school_id: "s1", name: "Arts & Humanities", code: "ART", is_active: true, created_at: "" },
  { id: "d3", school_id: "s1", name: "Social Studies", code: "SOC", is_active: true, created_at: "" },
];

const mockReligions: Religion[] = [
  { id: "r1", school_id: "s1", name: "Christianity", code: "CHR", is_active: true, created_at: "" },
  { id: "r2", school_id: "s1", name: "Islam", code: "ISL", is_active: true, created_at: "" },
];

// Test cases
console.log("=== Testing Smart Department Mapping ===");
console.log("Physics -> Science:", getSmartDepartmentId("Physics", mockDepartments)); // Should be d1
console.log("History -> Social Studies:", getSmartDepartmentId("History", mockDepartments)); // Should be d3
console.log("Literature in English -> Arts & Humanities:", getSmartDepartmentId("Literature in English", mockDepartments)); // Should be d2
console.log("Mathematics -> (no match):", getSmartDepartmentId("Mathematics", mockDepartments)); // Should be ""

console.log("\n=== Testing Smart Religion Mapping ===");
console.log("Is Religious Studies a religion subject?", isReligionSubject("Religious Studies")); // true
console.log("Is History a religion subject?", isReligionSubject("History")); // false
console.log("Religion ID for Religious Studies:", getSmartReligionId("Religious Studies", mockReligions)); // Should be r1
console.log("Religion ID for Physics:", getSmartReligionId("Physics", mockReligions)); // Should be ""

console.log("\n=== Testing Level-based Subject Loading ===");
const jssSubjects = getSubjectsForLevel("JSS");
console.log(`JSS subjects count: ${jssSubjects.length}`); // Should be 18+
console.log("First 5 JSS subjects:", jssSubjects.slice(0, 5).map(s => s.name));

const sssSubjects = getSubjectsForLevel("SSS");
console.log(`\nSSS subjects count: ${sssSubjects.length}`); // Should be 28+
const scienceSubjects = sssSubjects.filter(s => s.category === "science");
console.log("Science subjects in SSS:", scienceSubjects.map(s => s.name));
