/**
 * Teacher ID Card PDF Export Utility
 * Generates printable PDF files of teacher ID cards
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports a teacher ID card as a PDF file
 * @param cardElement - HTML element containing the ID card
 * @param teacherName - Teacher's full name (for filename)
 * @param schoolName - School name (for filename)
 * @param staffId - Staff ID (for filename)
 */
export async function exportTeacherCardToPDF(
  cardElement: HTMLElement,
  teacherName: string,
  schoolName: string,
  staffId: string
): Promise<void> {
  try {
    // Generate canvas from HTML element with high quality
    const canvas = await html2canvas(cardElement, {
      scale: 3, // High quality for printing
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 0,
    });

    // Create PDF in credit card dimensions (85.6mm x 54mm)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85.6, 54], // Credit card size
      compress: true,
    });

    // Get canvas dimensions and calculate scaling
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Convert canvas to image and add to PDF
    const imgData = canvas.toDataURL('image/png', 0.95);
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    // Generate filename: SchoolName_StaffID_TeacherName_id_card.pdf
    const sanitizedSchoolName = schoolName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const sanitizedTeacherName = teacherName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${sanitizedSchoolName}_${staffId}_${sanitizedTeacherName}_id_card.pdf`;

    // Save the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}

/**
 * Exports multiple teacher ID cards as a PDF (one card per page)
 * @param cardElements - Array of HTML elements containing ID cards
 * @param teacherNames - Array of teacher names
 * @param schoolName - School name (for filename)
 */
export async function exportMultipleTeacherCardsToPDF(
  cardElements: HTMLElement[],
  teacherNames: string[],
  schoolName: string
): Promise<void> {
  try {
    // Create PDF in credit card dimensions
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85.6, 54],
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Process each card
    for (let i = 0; i < cardElements.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const canvas = await html2canvas(cardElements[i], {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0,
      });

      const imgData = canvas.toDataURL('image/png', 0.95);
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    // Generate filename
    const sanitizedSchoolName = schoolName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${sanitizedSchoolName}_teacher_id_cards_${new Date().toISOString().split('T')[0]}.pdf`;

    // Save the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting multiple PDFs:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}
