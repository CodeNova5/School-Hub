/**
 * QR Code Utilities
 * Handles encoding and decoding of student QR data
 */

/**
 * Encodes student information for QR code
 * @param studentId - Student UUID
 * @param schoolId - School UUID
 * @returns Base64 encoded QR data string
 */
export function encodeStudentQRData(studentId: string, schoolId: string): string {
  const qrData = {
    sid: studentId,      // Student ID (UUID)
    scid: schoolId,      // School ID (UUID)
    ts: Date.now(),      // Timestamp for freshness validation
  };

  try {
    const jsonString = JSON.stringify(qrData);
    // Encode to base64 for compact QR representation
    return Buffer.from(jsonString).toString('base64');
  } catch (error) {
    console.error('Error encoding QR data:', error);
    throw new Error('Failed to encode QR data');
  }
}

/**
 * Decodes QR code data back to student information
 * @param encodedData - Base64 encoded QR data
 * @returns Decoded object with student and school IDs
 */
export function decodeStudentQRData(encodedData: string): {
  sid: string;
  scid: string;
  ts: number;
} {
  try {
    const jsonString = Buffer.from(encodedData, 'base64').toString('utf-8');
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
