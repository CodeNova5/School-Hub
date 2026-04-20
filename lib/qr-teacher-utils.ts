/**
 * QR Code Utilities for Teachers
 * Handles encoding and decoding of teacher QR data
 */

const TEACHER_QR_PREFIX = 'TR1';

/**
 * Encodes teacher information for QR code
 * @param teacherId - Teacher UUID
 * @param schoolId - School UUID
 * @returns Compact QR data string
 */
export function encodeTeacherQRData(teacherId: string, schoolId: string): string {
  // Keep payload short for clearer/scannable QR on printed ID cards.
  return `${TEACHER_QR_PREFIX}|${teacherId}|${schoolId}`;
}

/**
 * Decodes QR code data back to teacher information
 * @param encodedData - Encoded QR data
 * @returns Decoded object with teacher and school IDs
 */
export function decodeTeacherQRData(encodedData: string): {
  tid: string;
  scid: string;
} {
  const trimmed = encodedData.trim();

  // Teacher format
  if (trimmed.startsWith(`${TEACHER_QR_PREFIX}|`)) {
    const parts = trimmed.split('|');
    if (parts.length >= 3) {
      return {
        tid: parts[1],
        scid: parts[2],
      };
    }
  }

  throw new Error('Invalid teacher QR code format');
}
