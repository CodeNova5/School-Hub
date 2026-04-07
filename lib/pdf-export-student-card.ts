/**
 * Student ID Card PDF Export Utility
 * Generates printable PDF files of student ID cards
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports a student ID card as a PDF file
 * @param cardElement - HTML element containing the ID card
 * @param studentName - Student's full name (for filename)
 * @param schoolName - School name (for filename)
 * @param studentId - Student ID (for filename)
 */
export async function exportStudentCardToPDF(
  cardElement: HTMLElement,
  studentName: string,
  schoolName: string,
  studentId: string
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
    // Convert to mm: 85.6mm = 24.2 inches at 96dpi, 54mm = 15.3 inches
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

    // Generate filename: SchoolName_StudentID_StudentName_id_card.pdf
    const sanitizedSchoolName = schoolName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const sanitizedStudentName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${sanitizedSchoolName}_${studentId}_${sanitizedStudentName}_id_card.pdf`;

    // Save the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}

/**
 * Exports multiple student ID cards as a PDF (one card per page)
 * @param cardElements - Array of HTML elements containing ID cards
 * @param studentNames - Array of student names
 * @param schoolName - School name (for filename)
 */
export async function exportMultipleCardsToPDF(
  cardElements: HTMLElement[],
  studentNames: string[],
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
    const filename = `${sanitizedSchoolName}_student_id_cards_batch.pdf`;

    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting multiple PDFs:', error);
    throw new Error('Failed to generate PDF batch. Please try again.');
  }
}

/**
 * Exports ID card as a high-quality image (PNG)
 * @param cardElement - HTML element containing the ID card
 * @param studentName - Student's name (for filename)
 * @param schoolName - School name (for filename)
 */
export async function exportCardAsImage(
  cardElement: HTMLElement,
  studentName: string,
  schoolName: string
): Promise<string> {
  try {
    const canvas = await html2canvas(cardElement, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 0,
    });

    // Create download link
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    
    const sanitizedSchoolName = schoolName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const sanitizedStudentName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${sanitizedSchoolName}_${sanitizedStudentName}_id_card.png`;
    link.click();

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error exporting image:', error);
    throw new Error('Failed to generate image. Please try again.');
  }
}
