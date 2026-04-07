/**
 * QR Code Utilities
 * Handles encoding and decoding of student QR data
 */

const QR_PREFIX = 'SH1';

/**
 * Encodes student information for QR code
 * @param studentId - Student UUID
 * @param schoolId - School UUID
 * @returns Compact QR data string
 */
export function encodeStudentQRData(studentId: string, schoolId: string): string {
  // Keep payload short for clearer/scannable QR on printed ID cards.
  return `${QR_PREFIX}|${studentId}|${schoolId}`;
}

/**
 * Decodes QR code data back to student information
 * Supports:
 * 1) New compact format: SH1|<studentId>|<schoolId>
 * 2) Legacy base64 JSON format: { sid, scid, ts }
 * @param encodedData - Encoded QR data
 * @returns Decoded object with student and school IDs
 */
export function decodeStudentQRData(encodedData: string): {
  sid: string;
  scid: string;
  ts?: number;
} {
  const trimmed = encodedData.trim();

  // New compact format.
  if (trimmed.startsWith(`${QR_PREFIX}|`)) {
    const parts = trimmed.split('|');
    if (parts.length >= 3) {
      return {
        sid: parts[1],
        scid: parts[2],
      };
    }
  }

  // Legacy format fallback (base64 encoded JSON).
  try {
    const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const jsonString = atob(padded);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error decoding QR data:', error);
    throw new Error('Failed to decode QR data');
  }
}

/**
 * Validates if QR data is fresh (within last 24 hours)
 * @param timestamp - Timestamp from decoded QR data
 * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
 * @returns true if data is fresh, false otherwise
 */
export function isQRDataFresh(timestamp: number, maxAgeMs = 24 * 60 * 60 * 1000): boolean {
  const now = Date.now();
  return now - timestamp <= maxAgeMs;
}
