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
          position: 'relative',
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
          {/* Top Banner with School Info and Logo */}
          <div
            style={{
              backgroundColor: colors.primary,
              color: '#ffffff',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `3px solid ${colors.secondary}`,
            }}
          >
            {/* School Logo */}
            {school.logo_url && (
              <img
                src={school.logo_url}
                alt="School Logo"
                style={{
                  width: '24px',
                  height: '24px',
                  objectFit: 'contain',
                  flexShrink: 0,
                }}
              />
            )}

            {/* School Name Centered */}
            <div
              style={{
                flex: 1,
                textAlign: 'center',
                margin: '0 8px',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  lineHeight: '1.1',
                }}
              >
                {school.name}
              </div>
            </div>

            {/* Empty space for balance */}
            <div style={{ width: '24px', flexShrink: 0 }} />
          </div>

          {/* Main Content Area */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Left Section - Student Photo */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '10px 12px',
                backgroundColor: '#f9fafb',
                borderRight: `1px solid ${colors.accent}`,
                width: '120px',
                flexShrink: 0,
              }}
            >
              {/* Student Photo */}
              <div
                style={{
                  width: '70px',
                  height: '85px',
                  backgroundColor: '#ffffff',
                  borderRadius: '3px',
                  border: `2px solid ${colors.secondary}`,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginBottom: '6px',
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
                      fontSize: '28px',
                      color: colors.secondary,
                      fontWeight: 'bold',
                    }}
                  >
                    {`${student.first_name.charAt(0)}${student.last_name.charAt(0)}`}
                  </div>
                )}
              </div>

              {/* Student Name */}
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#000000',
                  textAlign: 'center',
                  lineHeight: '1.2',
                  maxWidth: '100%',
                }}
              >
                {student.first_name} {student.last_name}
              </div>

              {/* Student Label */}
              <div
                style={{
                  fontSize: '7px',
                  fontWeight: '600',
                  color: '#6b7280',
                  letterSpacing: '0.5px',
                  marginTop: '2px',
                }}
              >
                STUDENT
              </div>
            </div>

            {/* Right Section - Card Details */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '8px 12px',
                position: 'relative',
                justifyContent: 'space-between',
              }}
            >
              {/* Top Right - Header with School Badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '4px',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '7px',
                      fontWeight: '600',
                      color: colors.secondary,
                      letterSpacing: '0.3px',
                    }}
                  >
                    SCAN ME FOR INFO
                  </div>
                </div>
                {/* ID Number Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '7px',
                      fontWeight: '600',
                      color: '#6b7280',
                    }}
                  >
                    ID Number:
                  </span>
                  <span
                    style={{
                      fontSize: '8px',
                      fontWeight: '700',
                      color: '#000000',
                    }}
                  >
                    {student.student_id}
                  </span>
                </div>
              </div>

              {/* QR Code in Top Left */}
              <div
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '24px',
                  width: '48px',
                  height: '48px',
                  backgroundColor: '#ffffff',
                  borderRadius: '2px',
                  border: `1px solid ${colors.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <QRCodeCanvas
                  value={qrData}
                  size={44}
                  level="L"
                  includeMargin={false}
                  className="qr-code"
                />
              </div>

              {/* Info Stack (Shifted right from QR Code) */}
              <div
                style={{
                  marginLeft: '54px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  fontSize: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Academic Year:</span>
                  <span style={{ fontWeight: '700', color: '#000000' }}>{academicYear}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Grade:</span>
                  <span style={{ fontWeight: '700', color: '#000000' }}>{student.class_name || 'N/A'}</span>
                </div>
              </div>

              {/* VOID Watermarks */}
              <div
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  zIndex: 0,
                  opacity: 0.15,
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#d1d5db',
                    letterSpacing: '1px',
                    transform: 'rotate(-15deg)',
                  }}
                >
                  VOID
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - School Address */}
          <div
            style={{
              backgroundColor: '#f3f4f6',
              borderTop: `1px solid ${colors.accent}`,
              padding: '4px 12px',
              textAlign: 'center',
              fontSize: '7px',
              color: '#4b5563',
              fontWeight: '500',
              letterSpacing: '0.3px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {school.address}
          </div>
        </div>
      </div>
    );
  }
);

IDCardTemplate.displayName = 'IDCardTemplate';

export default IDCardTemplate;
