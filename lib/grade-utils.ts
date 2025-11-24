export function calculateGrade(total: number) {
  if (total >= 75) return { grade: "A", remarks: "Excellent" };
  if (total >= 65) return { grade: "B", remarks: "Very Good" };
  if (total >= 55) return { grade: "C", remarks: "Good" };
  if (total >= 45) return { grade: "D", remarks: "Fair" };
  if (total >= 40) return { grade: "E", remarks: "Pass" };
  return { grade: "F", remarks: "Fail" };
}
