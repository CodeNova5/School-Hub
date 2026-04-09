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

    const schoolInitials = school.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase();
    
    // Get current academic year
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;

    return (
      <div
        ref={ref}
        style={{
          width: '345.6px',
          height: '216px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          position: 'relative',
        }}
      >
        {/* Background Pattern - Subtle geometric design */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '200px',
            height: '200px',
            opacity: 0.06,
            zIndex: 0,
          }}
          viewBox="0 0 200 200"
        >
          <defs>
            <pattern id="gears" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="20" cy="20" r="3" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="200" height="200" fill="url(#gears)" />
        </svg>

        {/* Card Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Header Section */}
          <div
            style={{
              backgroundColor: colors.primary,
              color: '#ffffff',
              padding: '8px 12px 7px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              position: 'relative',
              minHeight: '48px',
            }}
          >
            {/* Left: School Logo */}
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.5)', // Adjusted background color for better visibility
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {school.logo_url ? (
                <img
                  src={school.logo_url}
                  alt="School Logo"
                  crossOrigin="anonymous"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover', // Ensures the logo fills the area
                    display: 'block',
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '900',
                    letterSpacing: '0.5px',
                  }}
                >
                  {schoolInitials}
                </span>
              )}
            </div>

            {/* Center: School Name and Address */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'center',
                lineHeight: '1.15',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '0.8px',
                  lineHeight: '1.1',
                  textTransform: 'uppercase',
                }}
              >
                {school.name}
              </div>
              <div
                style={{
                  marginTop: '2px',
                  fontSize: '7px',
                  fontWeight: '500',
                  letterSpacing: '0.2px',
                  opacity: 0.92,
                  lineHeight: '1.2',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxHeight: '17px',
                }}
              >
                {school.address}
              </div>
            </div>

            {/* Right: Empty for balance */}
            <div style={{ width: '34px', flexShrink: 0 }} />
          </div>

          {/* Colored Accent Bar */}
          <div
            style={{
              height: '3px',
              background: `linear-gradient(90deg, ${colors.secondary} 0%, ${colors.accent} 100%)`,
            }}
          />

          {/* Main Content Area */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              gap: 0,
              position: 'relative',
            }}
          >
            {/* Left Section - Student Photo & Name */}
            <div
              style={{
                width: '130px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '10px 10px',
                backgroundColor: '#fafbfc',
                borderRight: `1px solid #e5e7eb`,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {/* Student Photo with Border */}
              <div
                style={{
                  width: '80px',
                  height: '95px',
                  backgroundColor: '#ffffff',
                  borderRadius: '4px',
                  border: `3px solid ${colors.secondary}`,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginBottom: '8px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
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
                      fontSize: '32px',
                      color: colors.secondary,
                      fontWeight: '900',
                    }}
                  >
                    {`${student.first_name.charAt(0)}${student.last_name.charAt(0)}`}
                  </div>
                )}
              </div>

              {/* Student Name - Large and Bold */}
              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: '900',
                  color: '#1a1a1a',
                  textAlign: 'center',
                  lineHeight: '1.1',
                  maxWidth: '100%',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                {student.first_name} {student.last_name}
              </div>

              {/* Student Label */}
              <div
                style={{
                  fontSize: '7.5px',
                  fontWeight: '700',
                  color: '#6b7280',
                  letterSpacing: '0.7px',
                  marginTop: '3px',
                  textTransform: 'uppercase',
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
                padding: '9px 12px',
                position: 'relative',
                justifyContent: 'space-between',
              }}
            >
              {/* Top: Scan Me For Info */}
              <div
                style={{
                  fontSize: '7px',
                  fontWeight: '700',
                  color: colors.secondary,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  marginBottom: '2px',
                }}
              >
                Scan Me For Info
              </div>

              {/* QR Code */}
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginBottom: '4px',
                }}
              >
                <QRCodeCanvas
                  value={qrData}
                  size={64}
                  level="M"
                  includeMargin={true}
                  fgColor="#000000"
                  bgColor="#ffffff"
                  className="qr-code"
                />
              </div>

              {/* Info Details */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  fontSize: '8.5px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>ID Number:</span>
                  <span style={{ fontWeight: '900', color: '#000000' }}>{student.student_id}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Academic Year:</span>
                  <span style={{ fontWeight: '900', color: '#000000' }}>{academicYear}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Grade:</span>
                  <span style={{ fontWeight: '900', color: '#000000' }}>{student.class_name || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* VOID Watermarks - Right Side */}
            <div
              style={{
                position: 'absolute',
                right: '2px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                zIndex: 0,
                opacity: 0.12,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '900',
                  color: '#9ca3af',
                  letterSpacing: '1.2px',
                  transform: 'rotate(-20deg)',
                }}
              >
                VOID
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '900',
                  color: '#9ca3af',
                  letterSpacing: '1.2px',
                  transform: 'rotate(-20deg)',
                }}
              >
                VOID
              </div>
            </div>
          </div>

          {/* Footer - School Address */}
          <div
            style={{
              backgroundColor: '#f0f1f3',
              borderTop: `1px solid #e5e7eb`,
              padding: '4px 12px',
              textAlign: 'center',
              fontSize: '7px',
              color: '#5a5f6b',
              fontWeight: '600',
              letterSpacing: '0.2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Official Student ID Card
          </div>
        </div>
      </div>
    );
  }
);

IDCardTemplate.displayName = 'IDCardTemplate';

export default IDCardTemplate;
