/**
 * Generate unique subject codes using consonant extraction
 * Logic: First 3 consonants, if duplicate try 4, if still duplicate append random 2-digit hash
 */

/**
 * Extract consonants from a string
 */
function extractConsonants(text: string): string {
  const vowels = /[aeiouAEIOU]/g;
  return text.replace(/\s+/g, "").replace(vowels, "").toUpperCase();
}

/**
 * Generate a subject code with duplicate detection
 * @param subjectName - The name of the subject
 * @param className - The name of the class
 * @param existingCodes - Array of existing subject codes in this class (for duplicate detection)
 * @returns Unique subject code
 */
export function generateUniqueSubjectCode(
  subjectName: string,
  className: string,
  existingCodes: string[] = []
): string {
  const consonants = extractConsonants(subjectName);

  // Try 3 consonants first
  let attempt = consonants.slice(0, 3);
  let code = `${attempt}-${className}`;

  // Check if code already exists
  if (!existingCodes.includes(code)) {
    return code;
  }

  // Try 4 consonants if 3 are available
  if (consonants.length >= 4) {
    attempt = consonants.slice(0, 4);
    code = `${attempt}-${className}`;

    if (!existingCodes.includes(code)) {
      return code;
    }
  }

  // If still conflict, add random 2-digit hash
  const randomHash = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  attempt = consonants.slice(0, 3);
  code = `${attempt}${randomHash}-${className}`;

  return code;
}
