"use client";

import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { encodeStudentQRData } from '@/lib/qr-utils';

interface StudentData {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  image_url?: string;
  class_name?: string;
}

interface SchoolData {
  id: string;
  name: string;
  address: string;
  logo_url: string;
}

interface CardColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface IDCardTemplateProps {
  student: StudentData;
  school: SchoolData;
  colors: CardColors;
}

const IDCardTemplate = React.forwardRef<HTMLDivElement, IDCardTemplateProps>(
  ({ student, school, colors }, ref) => {
    // Generate QR code data
    const qrData = encodeStudentQRData(student.id, school.id);
    
    // Get current academic year
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;

    return (
      <div
        ref={ref}
        style={{
          width: '345.6px', // 85.6mm in pixels at 96dpi
          height: '216px',  // 54mm in pixels at 96dpi
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Card Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative',
          }}
        >
          {/* Top Banner with School Info */}
          <div
            style={{
              backgroundColor: colors.primary,
              color: '#ffffff',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderBottom: `3px solid ${colors.secondary}`,
            }}
          >
            {/* School Logo */}
            {school.logo_url && (
              <img
                src={school.logo_url}
                alt="School Logo"
                style={{
                  width: '28px',
                  height: '28px',
                  objectFit: 'contain',
                  flexShrink: 0,
                }}
              />
            )}

            {/* School Name & Address */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {school.name}
              </div>
              <div
                style={{
                  fontSize: '8px',
                  opacity: '0.9',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {school.address}
              </div>
            </div>
          </div>

          {/* Middle Section - Student Info */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              gap: '12px',
              padding: '12px 16px',
              alignItems: 'center',
            }}
          >
            {/* Student Photo */}
            <div
              style={{
                width: '60px',
                height: '80px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                border: `2px solid ${colors.accent}`,
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {student.image_url ? (
                <img
                  src={student.image_url}
                  alt="Student"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    fontSize: '24px',
                    color: colors.secondary,
                    fontWeight: 'bold',
                  }}
                >
                  {`${student.first_name.charAt(0)}${student.last_name.charAt(0)}`}
                </div>
              )}
            </div>

            {/* Student Details Stack */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '80px',
              }}
            >
              {/* Full Name */}
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: colors.primary,
                  lineHeight: '1.2',
                }}
              >
                {student.first_name} {student.last_name}
              </div>

              {/* Student ID */}
              <div
                style={{
                  fontSize: '9px',
                  color: '#6b7280',
                  fontWeight: '500',
                  letterSpacing: '0.5px',
                }}
              >
                ID: <span style={{ fontWeight: '700', color: colors.secondary }}>{student.student_id}</span>
              </div>

              {/* Class & Year Row */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  fontSize: '9px',
                }}
              >
                <div style={{ color: '#6b7280' }}>
                  Class: <span style={{ fontWeight: '600', color: colors.secondary }}>{student.class_name || 'N/A'}</span>
                </div>
                <div style={{ color: '#6b7280' }}>
                  Year: <span style={{ fontWeight: '600', color: colors.secondary }}>{academicYear}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - QR Code & Validity Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px',
              borderTop: `1px solid ${colors.accent}`,
              backgroundColor: '#f9fafb',
              gap: '12px',
            }}
          >
            {/* QR Code */}
            <div
              style={{
                width: '56px',
                height: '56px',
                backgroundColor: '#ffffff',
                borderRadius: '4px',
                border: `1px solid ${colors.accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <QRCodeCanvas
                value={qrData}
                size={52}
                level="L"
                includeMargin={false}
                className="qr-code"
              />
            </div>

            {/* Validity Badge */}
            <div
              style={{
                padding: '4px 8px',
                backgroundColor: colors.primary,
                color: '#ffffff',
                borderRadius: '4px',
                textAlign: 'center',
                fontSize: '8px',
                fontWeight: '600',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}
            >
              VALID
              <br />
              {currentYear}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

IDCardTemplate.displayName = 'IDCardTemplate';

export default IDCardTemplate;
