"use client";

import React, { forwardRef } from "react";

/* ── Shared Types ── */

interface SubjectScore {
  subject_class_id: string;
  subject_name: string;
  component_scores: Record<string, number>;
  total: number;
  grade: string;
  remark: string;
}

interface ResultComponentTemplate {
  component_key: string;
  component_name: string;
  max_score: number;
  display_order: number;
  is_active: boolean;
}

interface ResultGradeScale {
  grade_label: string;
  min_percentage: number;
  remark: string;
  display_order: number;
}

interface DomainRatings {
  affective: Record<string, number>;
  psychomotor: Record<string, number>;
}

const DEFAULT_AFFECTIVE_TRAITS = [
  "Punctuality / Regularity",
  "Neatness & Hygiene",
  "Honesty & Trust",
  "Relationship with Peers",
  "Obedience & Compliance",
  "Leadership Dynamics",
];

const DEFAULT_PSYCHOMOTOR_TRAITS = [
  "Verbal Fluency",
  "Sports & Athletics",
  "Crafts & Manual Skills",
  "Musical/Artistic Skills",
  "Handling Lab Tools",
  "Club & Societies",
];

/* ── Props ── */

export interface ReportCardPreviewProps {
  school: { name: string; address: string; phone: string; logo_url: string; motto?: string } | null;
  student: { first_name: string; last_name: string; student_id: string; gender?: string; photo_url?: string; image_url?: string } | null;
  studentClass: { name: string } | null;
  session: { name: string; end_date?: string } | null;
  term: { name: string } | null;
  scores: SubjectScore[];
  showPosition?: boolean;

  totalScore: number;
  maxTotalScore: number;
  averagePercentage: number;
  overallGrade: string;

  attendance: number;
  nextTermDate: string;
  classPosition: number | null;
  totalStudents: number | null;
  classAverage: number | null;

  teacherName: string;
  teacherSignature: string | null;
  principalSignature: string | null;

  classTeacherRemark: string;
  principalRemark: string;

  domainRatings: DomainRatings;

  gradeScale: ResultGradeScale[];
  configuredPassPercentage: number;

  visibleComponentTemplates: ResultComponentTemplate[];

  getGradeColor: (grade: string) => string;
  getPositionDisplay: (position: number | null | undefined) => string;
  getPositionOrdinal: (position: number | null | undefined, total: number | null | undefined) => string;
}

/* ── Component ── */

const ReportCardPreview = forwardRef<HTMLDivElement, ReportCardPreviewProps>(function ReportCardPreview(props, ref) {
  const {
    school,
    student,
    studentClass,
    session,
    term,
    scores,
    totalScore,
    maxTotalScore,
    averagePercentage,
    overallGrade,
    attendance,
    nextTermDate,
    classPosition,
    totalStudents,
    classAverage,
    teacherName,
    teacherSignature,
    principalSignature,
    classTeacherRemark,
    principalRemark,
    domainRatings,
    gradeScale,
    configuredPassPercentage,
    showPosition = true,
    visibleComponentTemplates,
    getGradeColor,
    getPositionDisplay,
    getPositionOrdinal,
  } = props;

  function resolveGradeFromPercentage(percentage: number, passPercentage: number) {
    const sortedScale = [...gradeScale].sort((a, b) => b.min_percentage - a.min_percentage);
    const fallback = sortedScale[sortedScale.length - 1] || { grade_label: "F9", remark: "Fail", min_percentage: 0, display_order: 99 };
    const matched = sortedScale.find((item) => percentage >= item.min_percentage) || fallback;

    if (percentage < passPercentage) {
      return { grade: fallback.grade_label, remark: fallback.remark || "Fail" };
    }

    return { grade: matched.grade_label, remark: matched.remark || "" };
  }

  return (
    <div
      ref={ref}
      id="printable-content"
      style={{
        maxWidth: "820px",
        margin: "0 auto",
        background: "#ffffff",
        padding: "30px",
        border: "2px solid #0b5345",
        boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        color: "#2c3e50",
        fontSize: "13px",
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "4px double #0b5345",
          paddingBottom: "10px",
          marginBottom: "15px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: "85px",
            height: "85px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {school?.logo_url ? (
            <img
              src={school.logo_url}
              alt="School Logo"
              style={{ height: "100%", width: "100%", objectFit: "contain" }}
            />
          ) : (
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "75px", height: "75px" }}>
              <circle cx="50" cy="50" r="45" fill="#0b5345" />
              <polygon points="50,18 78,40 68,75 32,75 22,40" fill="#d4ac0d" />
              <path d="M35,45 Q50,35 65,45 L65,58 Q50,48 35,58 Z" fill="#ffffff" />
              <rect x="47" y="42" width="6" height="25" fill="#0b5345" />
              <circle cx="50" cy="33" r="4" fill="#ffffff" />
            </svg>
          )}
        </div>

        {/* School Details */}
        <div style={{ textAlign: "center", flexGrow: 1, padding: "0 15px" }}>
          <h1 style={{ color: "#0b5345", margin: "0 0 3px 0", fontSize: "22px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {school?.name || "SCHOOL NAME"}
          </h1>
          <p style={{ margin: "2px 0", fontSize: "13px" }}>
            {school?.address || "School Address, City, State"}
          </p>
          <p style={{ margin: "2px 0", fontSize: "13px" }}>
            {school?.phone ? `Tel: ${school.phone}` : ""}
          </p>
          {school?.motto && (
            <p style={{ fontWeight: "bold", marginTop: "5px", color: "#0b5345", fontSize: "12px" }}>
              MOTTO: {school.motto}
            </p>
          )}
        </div>

        {/* Passport Photo */}
        <div
          style={{
            width: "85px",
            height: "85px",
            border: "1px solid #a6acaf",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
            background: "#f8f9fa",
          }}
        >
          {student?.photo_url || student?.image_url ? (
            <img
              src={student.photo_url || student.image_url}
              alt="Student Passport"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: "10px", color: "#7f8c8d" }}>Passport</span>
          )}
        </div>
      </div>

      {/* ── TITLE BAR ── */}
      <div
        style={{
          textAlign: "center",
          background: "#0b5345",
          color: "white",
          padding: "6px",
          fontWeight: "bold",
          fontSize: "14px",
          letterSpacing: "1px",
          marginBottom: "15px",
          borderRadius: "4px",
        }}
      >
        TERMINAL STUDENT PROGRESS REPORT
      </div>

      {/* ── PROFILE TABLE ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "4px 8px", fontSize: "13px", width: "50%" }}>
              <span style={{ fontWeight: "bold", color: "#566573" }}>Student Name:</span>{" "}
              <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                {student?.first_name} {student?.last_name}
              </span>
            </td>
            <td style={{ padding: "4px 8px", fontSize: "13px", width: "50%" }}>
              <span style={{ fontWeight: "bold", color: "#566573" }}>Student ID:</span>{" "}
              <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                {student?.student_id}
              </span>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px 8px", fontSize: "13px" }}>
              <span style={{ fontWeight: "bold", color: "#566573" }}>Class:</span>{" "}
              <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                {studentClass?.name}
              </span>
            </td>
            <td style={{ padding: "4px 8px", fontSize: "13px" }}>
              <span style={{ fontWeight: "bold", color: "#566573" }}>Term / Year:</span>{" "}
              <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                {term?.name} / {session?.name}
              </span>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px 8px", fontSize: "13px" }}>
              <span style={{ fontWeight: "bold", color: "#566573" }}>Gender:</span>{" "}
              <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                {student?.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "\u2014"}
              </span>
            </td>
            <td style={{ padding: "4px 8px", fontSize: "13px" }}>
              <span style={{ fontWeight: "bold", color: "#566573" }}>No. in Class:</span>{" "}
              <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                {totalStudents || "\u2014"}
              </span>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px 8px", fontSize: "13px" }}>
              <span style={{ fontWeight: "bold", color: "#566573" }}>Attendance:</span>{" "}
              <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                {attendance} Day{attendance !== 1 ? "s" : ""}
              </span>
            </td>
            <td style={{ padding: "4px 8px", fontSize: "13px" }}>
              <span style={{ fontWeight: "bold", color: "#566573" }}>Next Term Begins:</span>{" "}
              <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                {nextTermDate && !isNaN(new Date(nextTermDate).getTime())
                  ? new Date(nextTermDate).toLocaleDateString("en-GB")
                  : "\u2014"}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── DATA TABLE ── */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "15px",
          fontSize: "12px",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          <col style={{ width: "24%" }} />
          {visibleComponentTemplates.map(() => (
            <col key={Math.random()} style={{ width: "9%" }} />
          ))}
          <col style={{ width: "9%" }} />
          {showPosition && <col style={{ width: "10%" }} />}
          {showPosition && <col style={{ width: "7%" }} />}
          <col style={{ width: "7%" }} />
          <col style={{ width: "auto" }} />
        </colgroup>
        <thead>
          <tr>
            <th
              rowSpan={2}
              style={{
                border: "1px solid #a6acaf",
                padding: "6px 4px",
                textAlign: "center",
                background: "#0b5345",
                color: "white",
                fontWeight: 600,
              }}
            >
              Subjects
            </th>
            <th
              colSpan={visibleComponentTemplates.length}
              style={{
                border: "1px solid #a6acaf",
                padding: "6px 4px",
                textAlign: "center",
                background: "#0b5345",
                color: "white",
                fontWeight: 600,
              }}
            >
              Scores
            </th>
            <th
              rowSpan={2}
              style={{
                border: "1px solid #a6acaf",
                padding: "6px 4px",
                textAlign: "center",
                background: "#0b5345",
                color: "white",
                fontWeight: 600,
              }}
            >
              Total
            </th>
            {showPosition && (
              <th
                rowSpan={2}
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  background: "#0b5345",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Class<br />Avg
              </th>
            )}
            <th
              rowSpan={2}
              style={{
                border: "1px solid #a6acaf",
                padding: "6px 4px",
                textAlign: "center",
                background: "#0b5345",
                color: "white",
                fontWeight: 600,
              }}
            >
              Pos
            </th>
            <th
              rowSpan={2}
              style={{
                border: "1px solid #a6acaf",
                padding: "6px 4px",
                textAlign: "center",
                background: "#0b5345",
                color: "white",
                fontWeight: 600,
              }}
            >
              Grade
            </th>
            <th
              rowSpan={2}
              style={{
                border: "1px solid #a6acaf",
                padding: "6px 4px",
                textAlign: "center",
                background: "#0b5345",
                color: "white",
                fontWeight: 600,
              }}
            >
              Remarks
            </th>
          </tr>
          <tr>
            {visibleComponentTemplates.map((component) => (
              <th
                key={component.component_key}
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  background: "#0b5345",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "11px",
                }}
              >
                {component.component_name}<br />({component.max_score})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scores.map((score, index) => (
            <tr key={score.subject_class_id} style={{ background: index % 2 === 0 ? "#f9f9f9" : "#ffffff" }}>
              <td
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "left",
                  paddingLeft: "8px",
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {score.subject_name}
              </td>
              {visibleComponentTemplates.map((component) => (
                <td
                  key={component.component_key}
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "center",
                    fontWeight: 600,
                    fontSize: "12px",
                  }}
                >
                  {score.component_scores?.[component.component_key] || 0}
                </td>
              ))}
              <td
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#0b5345",
                }}
              >
                {score.total}
              </td>
              {showPosition && (
                <td
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "center",
                    fontSize: "11px",
                    color: "#566573",
                  }}
                >
                  {classAverage?.toFixed(1) || "\u2014"}
                </td>
              )}
              <td
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                {showPosition ? getPositionDisplay(classPosition) : "\u2014"}
              </td>
              <td
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: getGradeColor(score.grade),
                }}
              >
                {score.grade}
              </td>
              <td
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  fontSize: "11px",
                  fontStyle: "italic",
                  color: "#566573",
                }}
              >
                {score.remark}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── DOMAINS (Affective + Psychomotor) ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "15px",
          marginBottom: "15px",
        }}
      >
        {/* Affective Domain */}
        <div style={{ flex: 1, width: "50%" }}>
          <h3
            style={{
              color: "#0b5345",
              fontSize: "13px",
              borderBottom: "2px solid #0b5345",
              marginTop: 0,
              paddingBottom: "3px",
              marginBottom: "8px",
            }}
          >
            AFFECTIVE DOMAIN
          </h3>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12px",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: "75%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "left",
                    paddingLeft: "8px",
                    background: "#0b5345",
                    color: "white",
                    fontWeight: 600,
                  }}
                >
                  Trait Evaluation
                </th>
                <th
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "center",
                    background: "#0b5345",
                    color: "white",
                    fontWeight: 600,
                  }}
                >
                  Rating
                </th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_AFFECTIVE_TRAITS.map((trait) => (
                <tr key={trait}>
                  <td
                    style={{
                      border: "1px solid #a6acaf",
                      padding: "5px 4px",
                      textAlign: "left",
                      paddingLeft: "8px",
                      fontSize: "12px",
                    }}
                  >
                    {trait}
                  </td>
                  <td
                    style={{
                      border: "1px solid #a6acaf",
                      padding: "5px 4px",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    {domainRatings.affective[trait] || 5}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Psychomotor Domain */}
        <div style={{ flex: 1, width: "50%" }}>
          <h3
            style={{
              color: "#0b5345",
              fontSize: "13px",
              borderBottom: "2px solid #0b5345",
              marginTop: 0,
              paddingBottom: "3px",
              marginBottom: "8px",
            }}
          >
            PSYCHOMOTOR DOMAIN
          </h3>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12px",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: "75%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "left",
                    paddingLeft: "8px",
                    background: "#0b5345",
                    color: "white",
                    fontWeight: 600,
                  }}
                >
                  Skill Evaluation
                </th>
                <th
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "center",
                    background: "#0b5345",
                    color: "white",
                    fontWeight: 600,
                  }}
                >
                  Rating
                </th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_PSYCHOMOTOR_TRAITS.map((trait) => (
                <tr key={trait}>
                  <td
                    style={{
                      border: "1px solid #a6acaf",
                      padding: "5px 4px",
                      textAlign: "left",
                      paddingLeft: "8px",
                      fontSize: "12px",
                    }}
                  >
                    {trait}
                  </td>
                  <td
                    style={{
                      border: "1px solid #a6acaf",
                      padding: "5px 4px",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    {domainRatings.psychomotor[trait] || 5}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SUMMARY BAR ── */}
      <div
        style={{
          border: "1px solid #0b5345",
          borderRadius: "4px",
          padding: "8px",
          marginBottom: "15px",
          background: "#fcfcfc",
        }}
      >
        <table style={{ width: "100%", textAlign: "center", borderCollapse: "collapse", fontSize: "13px" }}>
          <tbody>
            <tr>
              <td style={{ padding: "2px", width: "25%" }}>
                <strong style={{ color: "#0b5345" }}>TOTAL:</strong>{" "}
                <strong>{totalScore} / {maxTotalScore}</strong>
              </td>
              <td
                style={{
                  padding: "2px",
                  borderLeft: "1px solid #a6acaf",
                  width: "25%",
                }}
              >
                <strong style={{ color: "#0b5345" }}>PERCENT:</strong>{" "}
                <strong>{averagePercentage.toFixed(2)}%</strong>
              </td>
              <td
                style={{
                  padding: "2px",
                  borderLeft: "1px solid #a6acaf",
                  width: showPosition ? "25%" : "33%",
                }}
              >
                <strong style={{ color: "#0b5345" }}>CLASS AVG:</strong>{" "}
                <strong>{classAverage?.toFixed(2) || "\u2014"}%</strong>
              </td>
              <td
                style={{
                  padding: "2px",
                  borderLeft: "1px solid #a6acaf",
                  width: showPosition ? "25%" : "33%",
                }}
              >
                <strong style={{ color: "#0b5345" }}>{showPosition ? "POSITION:" : "CLASS AVG:"}</strong>{" "}
                <strong>{showPosition ? getPositionOrdinal(classPosition, totalStudents) : (classAverage?.toFixed(2) || "\u2014") + "%"}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── FOOTER SECTION ── */}
      <div style={{ marginTop: "15px", fontSize: "13px", pageBreakInside: "avoid" }}>
        {/* Class Teacher Remark */}
        <div style={{ marginBottom: "10px", display: "flex", alignItems: "baseline" }}>
          <span style={{ fontWeight: "bold", width: "150px", flexShrink: 0 }}>
            Form Teacher's Remark:
          </span>
          <span
            style={{
              flexGrow: 1,
              borderBottom: "1px dashed #a6acaf",
              fontStyle: "italic",
              paddingLeft: "5px",
            }}
          >
            {classTeacherRemark || "\u00A0"}
          </span>
        </div>

        {/* Principal Remark */}
        <div style={{ marginBottom: "10px", display: "flex", alignItems: "baseline" }}>
          <span style={{ fontWeight: "bold", width: "150px", flexShrink: 0 }}>
            Principal's Remark:
          </span>
          <span
            style={{
              flexGrow: 1,
              borderBottom: "1px dashed #a6acaf",
              fontStyle: "italic",
              paddingLeft: "5px",
            }}
          >
            {principalRemark || "\u00A0"}
          </span>
        </div>

        {/* Vacation / Resumption Dates */}
        <div
          style={{
            marginBottom: "10px",
            display: "flex",
            alignItems: "baseline",
            marginTop: "15px",
          }}
        >
          <span style={{ fontWeight: "bold", width: "150px", flexShrink: 0, color: "#c0392b" }}>
            Vacation Date:
          </span>
          <span
            style={{
              flexGrow: 1,
              borderBottom: "1px dashed #a6acaf",
              fontWeight: "bold",
              paddingLeft: "5px",
            }}
          >
            {session?.end_date
              ? new Date(session.end_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "\u2014"}
          </span>
          <span
            style={{
              fontWeight: "bold",
              width: "140px",
              textAlign: "right",
              paddingRight: "10px",
              flexShrink: 0,
              color: "#27ae60",
            }}
          >
            Resumption Date:
          </span>
          <span
            style={{
              flexGrow: 1,
              borderBottom: "1px dashed #a6acaf",
              fontWeight: "bold",
              paddingLeft: "5px",
            }}
          >
            {nextTermDate && !isNaN(new Date(nextTermDate).getTime())
              ? new Date(nextTermDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "\u2014"}
          </span>
        </div>

        {/* Signatures / Stamps */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "25px",
            padding: "0 10px",
          }}
        >
          {/* Teacher Signature */}
          <div style={{ textAlign: "center", width: "180px" }}>
            <div
              style={{
                height: "25px",
                fontFamily: "'Courier New', monospace",
                fontSize: "14px",
                fontStyle: "italic",
                color: "#1a5276",
              }}
            >
              {teacherSignature ? (
                <img
                  src={teacherSignature}
                  alt="Teacher's Signature"
                  style={{ height: "30px", objectFit: "contain", display: "inline-block" }}
                />
              ) : (
                teacherName || "\u00A0"
              )}
            </div>
            <div
              style={{
                borderTop: "1px dashed #2c3e50",
                marginTop: "35px",
                paddingTop: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              {teacherName ? `${teacherName}` : "Form Teacher's Signature"}
            </div>
          </div>

          {/* Official Stamp */}
          <div style={{ position: "relative", height: "65px", width: "100px" }}>
            <svg
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                position: "absolute",
                top: "-15px",
                left: "12px",
                width: "75px",
                height: "75px",
                opacity: 0.75,
              }}
            >
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1f618d" strokeWidth="1.5" strokeDasharray="3,2" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="#1f618d" strokeWidth="0.75" />
              <text x="50" y="32" fontSize="6" fontWeight="bold" fill="#1f618d" textAnchor="middle">
                {school?.name ? school.name.substring(0, 18).toUpperCase() : "SCHOOL"}
              </text>
              <rect x="22" y="44" width="56" height="12" fill="none" stroke="#1f618d" strokeWidth="0.75" />
              <text x="50" y="52" fontSize="5" fontWeight="bold" fill="#c0392b" textAnchor="middle">
                APPROVED STAMP
              </text>
              <text x="50" y="74" fontSize="6" fontWeight="bold" fill="#1f618d" textAnchor="middle">
                NIGERIA
              </text>
            </svg>
          </div>

          {/* Principal Signature */}
          <div style={{ textAlign: "center", width: "180px" }}>
            <div
              style={{
                height: "25px",
                fontFamily: "'Courier New', monospace",
                fontSize: "14px",
                fontStyle: "italic",
                color: "#1a5276",
              }}
            >
              {principalSignature ? (
                <img
                  src={principalSignature}
                  alt="Principal's Signature"
                  style={{ height: "30px", objectFit: "contain", display: "inline-block" }}
                />
              ) : (
                "\u00A0"
              )}
            </div>
            <div
              style={{
                borderTop: "1px dashed #2c3e50",
                marginTop: "35px",
                paddingTop: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Principal's Signature & Date
            </div>
            <div style={{ fontSize: "11px", color: "#566573", marginTop: "2px" }}>
              {new Date().toLocaleDateString("en-GB")}
            </div>
          </div>
        </div>
      </div>

      {/* ── GRADING LEGEND ── */}
      <div
        style={{
          border: "1px solid #a6acaf",
          padding: "8px",
          borderRadius: "4px",
          background: "#fafafa",
          marginTop: "15px",
          display: "flex",
          justifyContent: "space-around",
          fontSize: "10px",
          pageBreakInside: "avoid",
        }}
      >
        <div>
          <div
            style={{
              fontWeight: "bold",
              color: "#0b5345",
              marginBottom: "2px",
              fontSize: "11px",
            }}
          >
            COGNITIVE GRADING KEY (WAEC Standard)
          </div>
          <span>75 - 100 = A1 (Excellent)</span> &nbsp;&nbsp;
          <span>70 - 74 = B2 (Very Good)</span> &nbsp;&nbsp;
          <span>65 - 69 = B3 (Good)</span><br />
          <span>60 - 64 = C4 (Credit)</span> &nbsp;&nbsp;
          <span>55 - 59 = C5 (Credit)</span> &nbsp;&nbsp;
          <span>50 - 54 = C6 (Credit)</span><br />
          <span>45 - 49 = D7 (Pass)</span> &nbsp;&nbsp;
          <span>40 - 44 = E8 (Pass)</span> &nbsp;&nbsp;
          <span>0 - 39 = F9 (Fail)</span>
        </div>
        <div style={{ borderLeft: "1px solid #a6acaf", paddingLeft: "15px" }}>
          <div
            style={{
              fontWeight: "bold",
              color: "#0b5345",
              marginBottom: "2px",
              fontSize: "11px",
            }}
          >
            BEHAVIORAL RATING
          </div>
          <span>5 = Excellent</span><br />
          <span>4 = Commendable</span><br />
          <span>3 = Average</span><br />
          <span>2 = Needs Improvement</span><br />
          <span>1 = Unsatisfactory</span>
        </div>
      </div>
    </div>
  );
});

export default ReportCardPreview;
