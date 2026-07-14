/**
 * Receipt / Invoice PDF Export Utility
 * Generates professional A4 PDF receipts with school branding,
 * student details, payment breakdown, and Paystack reference.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ReceiptData {
  receiptNumber: string;
  issuedAt: string;
  studentName: string;
  studentId?: string;
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
  status: string;
  billItems?: Array<{ title: string; amount: number }>;
  currency?: string;
}

export interface SchoolInfo {
  name: string;
  address?: string;
  phone?: string;
  logo_url?: string;
  motto?: string;
}

function formatCurrency(amount: number, currency = 'NGN'): string {
  return `${currency} ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Generates a receipt element as an HTML string, then captures it
 * with html2canvas and produces an A4 PDF.
 */
export async function generateReceiptPDF(
  receipt: ReceiptData,
  school: SchoolInfo
): Promise<void> {
  try {
    // Build a temporary container to render the receipt
    const container = document.createElement('div');
    container.id = 'receipt-pdf-container';
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: 794px;
      background: #ffffff;
      font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #1f2937;
      z-index: -1;
    `;
    container.innerHTML = buildReceiptHTML(receipt, school);
    document.body.appendChild(container);

    // Wait for fonts and images to fully load
    await document.fonts?.ready;

    const images = Array.from(container.querySelectorAll('img'));
    if (images.length > 0) {
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
              } else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                // Fallback timeout
                setTimeout(resolve, 3000);
              }
            })
        )
      );
    }

    // Small extra delay for rendering layout
    await new Promise((r) => setTimeout(r, 200));

    const canvas = await html2canvas(container, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 0,
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 0;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(
      (pdfWidth - margin * 2) / imgWidth,
      (pdfHeight - margin * 2) / imgHeight
    );
    const displayWidth = imgWidth * ratio;
    const displayHeight = imgHeight * ratio;

    // If content is taller than one page, add extra pages
    let heightLeft = displayHeight;
    let position = margin;

    pdf.addImage(imgData, 'JPEG', margin, position, displayWidth, displayHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - displayHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, displayWidth, displayHeight);
      heightLeft -= pdfHeight;
    }

    const safeName = receipt.studentName
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .slice(0, 30);
    const safeReceipt = receipt.receiptNumber.replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeName}_${safeReceipt}_receipt.pdf`.toLowerCase();

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    throw new Error('Failed to generate receipt PDF. Please try again.');
  }
}

/**
 * Builds the full receipt HTML with inline styles for html2canvas capture.
 */
function buildReceiptHTML(receipt: ReceiptData, school: SchoolInfo): string {
  const amountFormatted = formatCurrency(receipt.amount, receipt.currency);
  const dateFormatted = new Date(receipt.issuedAt).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted = new Date(receipt.issuedAt).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusColor =
    receipt.status === 'success' || receipt.status === 'paid'
      ? '#059669'
      : receipt.status === 'pending'
      ? '#d97706'
      : '#dc2626';

  const statusBg =
    receipt.status === 'success' || receipt.status === 'paid'
      ? '#ecfdf5'
      : receipt.status === 'pending'
      ? '#fffbeb'
      : '#fef2f2';

  // School logo block: try to use actual logo URL, fallback to initial
  const schoolInitial = school.name ? school.name.charAt(0).toUpperCase() : 'S';

  const logoHTML = school.logo_url
    ? `<img
        src="${school.logo_url}"
        alt="${school.name} logo"
        style="width: 56px; height: 56px; border-radius: 12px; object-fit: cover; background: #f3f0ff;"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
      />
      <div style="display:none; width:56px; height:56px; border-radius:12px; background:linear-gradient(135deg,#6366f1,#4f46e5); align-items:center; justify-content:center; color:#fff; font-size:22px; font-weight:800;">${schoolInitial}</div>`
    : `<div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:800;">${schoolInitial}</div>`;

  const billItemsHTML =
    (receipt.billItems || []).length > 0
      ? `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; background: #f9fafb;">Item</td>
        <td style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; background: #f9fafb; text-align: right;">Amount</td>
      </tr>
      ${(receipt.billItems || [])
        .map(
          (item) => `
          <tr>
            <td style="padding: 8px 12px; font-size: 12px; color: #4b5563; border-bottom: 1px solid #f3f4f6;">${item.title}</td>
            <td style="padding: 8px 12px; font-size: 12px; color: #1f2937; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${formatCurrency(item.amount, receipt.currency)}</td>
          </tr>
        `
        )
        .join('')}`
      : '';

  return `
    <div style="padding: 40px 48px; background: #ffffff;">

      <!-- HEADER: School Branding -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
        <tr>
          <td style="width: 60px; vertical-align: top;">
            ${logoHTML}
          </td>
          <td style="padding-left: 16px; vertical-align: top;">
            <div style="font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.3px;">${school.name || 'School Name'}</div>
            ${school.motto ? `<div style="font-size: 11px; color: #6b7280; font-style: italic; margin-top: 2px;">${school.motto}</div>` : ''}
            ${school.address ? `<div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">${school.address}</div>` : ''}
            ${school.phone ? `<div style="font-size: 10px; color: #9ca3af;">${school.phone}</div>` : ''}
          </td>
          <td style="text-align: right; vertical-align: top;">
            <div style="display: inline-block; padding: 6px 16px; border-radius: 8px; background: ${statusBg}; color: ${statusColor}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
              ${receipt.status}
            </div>
          </td>
        </tr>
      </table>

      <!-- DIVIDER -->
      <div style="height: 1px; background: linear-gradient(to right, #e5e7eb, transparent); margin-bottom: 28px;"></div>

      <!-- TITLE -->
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="font-size: 26px; font-weight: 800; color: #111827; letter-spacing: -0.5px;">RECEIPT OF PAYMENT</div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">#${receipt.receiptNumber}</div>
      </div>

      <!-- INFO ROW: Dates + Receipt # -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #f9fafb; border-radius: 10px; overflow: hidden;">
        <tr>
          <td style="padding: 14px 20px; width: 50%; border-right: 1px solid #f3f4f6;">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Date Issued</div>
            <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-top: 3px;">${dateFormatted}</div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 1px;">${timeFormatted}</div>
          </td>
          <td style="padding: 14px 20px; width: 50%;">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Receipt No.</div>
            <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-top: 3px; font-family: 'Courier New', monospace;">${receipt.receiptNumber}</div>
            ${receipt.transactionReference ? `<div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">Ref: ${receipt.transactionReference}</div>` : ''}
          </td>
        </tr>
      </table>

      <!-- STUDENT INFO -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 0 4px 6px 4px;">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Student Name</div>
            <div style="font-size: 15px; font-weight: 700; color: #111827; margin-top: 2px;">${receipt.studentName}</div>
          </td>
          ${receipt.studentId ? `
          <td style="padding: 0 4px 6px 4px; text-align: right;">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Student ID</div>
            <div style="font-size: 15px; font-weight: 700; color: #111827; margin-top: 2px; font-family: 'Courier New', monospace;">${receipt.studentId}</div>
          </td>
          ` : ''}
        </tr>
      </table>

      <!-- PAYMENT DETAILS TABLE -->
      <div style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${billItemsHTML ? `<thead>${billItemsHTML}</thead>` : ''}
          <tbody>
            <tr>
              <td style="padding: 10px 12px; font-size: 11px; color: #6b7280; border-bottom: 1px solid #f3f4f6; width: 50%;">
                <span style="font-weight: 600; color: #374151;">Payment Method</span>
              </td>
              <td style="padding: 10px 12px; font-size: 12px; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6; font-weight: 600;">
                ${receipt.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : receipt.paymentMethod.charAt(0).toUpperCase() + receipt.paymentMethod.slice(1)}
              </td>
            </tr>
            ${receipt.transactionReference ? `
            <tr>
              <td style="padding: 10px 12px; font-size: 11px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">
                <span style="font-weight: 600; color: #374151;">Transaction Reference</span>
              </td>
              <td style="padding: 10px 12px; font-size: 11px; color: #4b5563; text-align: right; border-bottom: 1px solid #f3f4f6; font-family: 'Courier New', monospace;">
                ${receipt.transactionReference}
              </td>
            </tr>
            ` : ''}
          </tbody>
        </table>
      </div>

      <!-- TOTAL -->
      <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: rgba(255,255,255,0.8); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Total Paid</td>
            <td style="text-align: right; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${amountFormatted}</td>
          </tr>
        </table>
      </div>

      <!-- PAYSTACK NOTE -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 20px; vertical-align: top;">
              <span style="font-size: 14px;">&#x1f512;</span>
            </td>
            <td style="padding-left: 8px; font-size: 11px; color: #166534;">
              <strong>Secure Payment</strong> &mdash; This payment was processed securely through <strong>Paystack</strong>.
              Funds are settled directly to the school&#39;s registered bank account.
            </td>
          </tr>
        </table>
      </div>

      <!-- THANK YOU -->
      <div style="text-align: center; padding-top: 8px; border-top: 1px solid #f3f4f6;">
        <div style="font-size: 13px; font-weight: 600; color: #374151;">Thank you for your payment!</div>
        <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">
          This is a computer-generated receipt. No signature required.
        </div>
        <div style="font-size: 9px; color: #d1d5db; margin-top: 6px;">
          ${school.name || 'School'} &middot; Receipt #${receipt.receiptNumber}
        </div>
      </div>

      <!-- SPACER for multi-page -->
      <div style="height: 20px;"></div>
    </div>
  `;
}
