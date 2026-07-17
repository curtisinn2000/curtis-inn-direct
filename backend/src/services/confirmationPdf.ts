import PDFDocument from 'pdfkit';
import type { ReservationNotification } from './notifications.js';

const COLORS = {
  ink: '#111827',
  muted: '#667085',
  line: '#D9DEE7',
  soft: '#F5F6F8',
  gold: '#E9A326',
  green: '#217A3C',
  blue: '#185FA5',
};

const PAGE_BOTTOM = 704;

export function createReservationConfirmationPdf(reservation: ReservationNotification): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: 'LETTER',
      margins: { top: 52, right: 48, bottom: 76, left: 48 },
      bufferPages: true,
      info: {
        Title: `Curtis Inn Reservation ${reservation.confirmationNumber}`,
        Author: 'Curtis Inn & Suites',
        Subject: 'Guest reservation confirmation',
      },
    });
    const chunks: Buffer[] = [];
    document.on('data', chunk => chunks.push(Buffer.from(chunk)));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('pageAdded', () => drawContinuationHeader(document, reservation.confirmationNumber));

    drawDocument(document, reservation);
    document.removeAllListeners('pageAdded');
    addPageFooters(document, reservation.confirmationNumber);
    document.end();
  });
}

function drawDocument(document: PDFKit.PDFDocument, reservation: ReservationNotification) {
  document.rect(0, 0, document.page.width, 8).fill(COLORS.gold);
  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(22).text('Curtis Inn & Suites');
  document.fillColor(COLORS.muted).font('Helvetica').fontSize(10).text('Comfort That Feels Like Home.');
  document.moveDown(1.2);

  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(17).text('Reservation Confirmation');
  const badgeX = document.page.width - document.page.margins.right - 84;
  const badgeY = document.y - 20;
  document.roundedRect(badgeX, badgeY, 84, 24, 4).fill(COLORS.green);
  document.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text('CONFIRMED', badgeX, badgeY + 7, {
    width: 84,
    align: 'center',
    lineBreak: false,
  });
  document.fillColor(COLORS.muted).font('Helvetica').fontSize(10)
    .text(`Confirmation number: ${reservation.confirmationNumber}`, document.page.margins.left, document.y + 5);

  sectionTitle(document, 'Stay details');
  keyValueRows(document, [
    ['Guest', guestName(reservation)],
    ['Stay', `${formatDate(reservation.checkIn)} to ${formatDate(reservation.checkOut)}`],
    ['Guests', `${reservation.guests}`],
    ['Rooms', roomSummary(reservation)],
  ]);

  sectionTitle(document, 'Room summary');
  if (reservation.roomLines.length) {
    reservation.roomLines.forEach(line => {
      keyValueRows(document, [[`${line.rooms} x ${line.roomTypeName}`, money(line.subtotalCents)]]);
    });
  } else {
    keyValueRows(document, [['Reserved rooms', `${reservation.rooms}`]]);
  }

  sectionTitle(document, 'Payment summary');
  keyValueRows(document, [
    ['Subtotal', money(reservation.subtotalCents)],
    ['Taxes and fees', money(reservation.taxCents)],
  ]);
  ensureSpace(document, 46);
  const totalY = document.y;
  document.roundedRect(document.page.margins.left, totalY, contentWidth(document), 40, 5).fill(COLORS.soft);
  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11).text('Total paid', document.page.margins.left + 12, totalY + 14);
  document.fontSize(14).text(money(reservation.totalCents), document.page.width - document.page.margins.right - 152, totalY + 12, {
    width: 140,
    align: 'right',
  });
  document.x = document.page.margins.left;
  document.y = totalY + 50;

  sectionTitle(document, 'Hotel information');
  ensureSpace(document, 86);
  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11).text('Curtis Inn & Suites');
  document.fillColor(COLORS.muted).font('Helvetica').fontSize(10)
    .text('1501 S Federal Hwy, Hollywood, FL')
    .text('Phone: (954) 555-0100 | Email: curtisinn200@gmail.com')
    .text('Check-in: 3:00 PM | Check-out: 11:00 AM');
  document.moveDown(0.8);
  document.fillColor(COLORS.ink).fontSize(9)
    .text('You can check your reservation on the Curtis Inn & Suites website using this confirmation number and the guest last name.');

  if (reservation.specialRequests.trim()) {
    const requestHeight = document.heightOfString(reservation.specialRequests, { width: contentWidth(document) - 24 }) + 24;
    ensureSpace(document, 50 + Math.min(requestHeight, 220));
    sectionTitle(document, 'Special requests');
    if (requestHeight <= 220) {
      const requestY = document.y;
      document.roundedRect(document.page.margins.left, requestY, contentWidth(document), requestHeight, 5).fill(COLORS.soft);
      document.fillColor(COLORS.ink).font('Helvetica').fontSize(10)
        .text(reservation.specialRequests, document.page.margins.left + 12, requestY + 12, { width: contentWidth(document) - 24 });
      document.x = document.page.margins.left;
      document.y = requestY + requestHeight + 8;
    } else {
      document.fillColor(COLORS.ink).font('Helvetica').fontSize(10)
        .text(reservation.specialRequests, { width: contentWidth(document) });
      document.x = document.page.margins.left;
      document.moveDown(0.8);
    }
  }

  if (reservation.stripeReceiptUrl) {
    sectionTitle(document, 'Payment receipt');
    ensureSpace(document, 28);
    document.fillColor(COLORS.blue).font('Helvetica-Bold').fontSize(10)
      .text('View your Stripe payment receipt', { link: reservation.stripeReceiptUrl, underline: true });
  }
}

function sectionTitle(document: PDFKit.PDFDocument, title: string) {
  ensureSpace(document, 42);
  document.x = document.page.margins.left;
  document.moveDown(1.1);
  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(12).text(title);
  document.moveTo(document.page.margins.left, document.y + 4)
    .lineTo(document.page.width - document.page.margins.right, document.y + 4)
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .stroke();
  document.y += 12;
}

function keyValueRows(document: PDFKit.PDFDocument, rows: Array<[string, string]>) {
  for (const [label, value] of rows) {
    const labelWidth = 150;
    const valueWidth = contentWidth(document) - labelWidth - 24;
    const height = Math.max(
      document.heightOfString(label, { width: labelWidth }),
      document.heightOfString(value, { width: valueWidth }),
    ) + 14;
    ensureSpace(document, height);
    const y = document.y;
    document.rect(document.page.margins.left, y, contentWidth(document), height).strokeColor(COLORS.line).lineWidth(0.7).stroke();
    document.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(9)
      .text(label, document.page.margins.left + 8, y + 7, { width: labelWidth });
    document.fillColor(COLORS.ink).font('Helvetica').fontSize(9)
      .text(value, document.page.margins.left + labelWidth + 16, y + 7, { width: valueWidth });
    document.x = document.page.margins.left;
    document.y = y + height;
  }
}

function ensureSpace(document: PDFKit.PDFDocument, requiredHeight: number) {
  if (document.y + requiredHeight > PAGE_BOTTOM) document.addPage();
}

function drawContinuationHeader(document: PDFKit.PDFDocument, confirmationNumber: string) {
  document.rect(0, 0, document.page.width, 6).fill(COLORS.gold);
  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(12).text('Curtis Inn & Suites');
  document.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(`Reservation ${confirmationNumber}`);
  document.moveDown(1.2);
}

function addPageFooters(document: PDFKit.PDFDocument, confirmationNumber: string) {
  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    const bottomMargin = document.page.margins.bottom;
    document.page.margins.bottom = 0;
    const footerY = document.page.height - 42;
    document.moveTo(document.page.margins.left, footerY - 8)
      .lineTo(document.page.width - document.page.margins.right, footerY - 8)
      .strokeColor(COLORS.line)
      .lineWidth(0.7)
      .stroke();
    document.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(`Curtis Inn & Suites | ${confirmationNumber}`, document.page.margins.left, footerY, { lineBreak: false });
    document.text(`Page ${index + 1} of ${range.count}`, document.page.width - document.page.margins.right - 100, footerY, {
      width: 100,
      align: 'right',
      lineBreak: false,
    });
    document.page.margins.bottom = bottomMargin;
  }
}

function contentWidth(document: PDFKit.PDFDocument) {
  return document.page.width - document.page.margins.left - document.page.margins.right;
}

function roomSummary(reservation: ReservationNotification) {
  return reservation.roomLines.length
    ? reservation.roomLines.map(line => `${line.rooms} x ${line.roomTypeName}`).join(', ')
    : `${reservation.rooms} room${reservation.rooms === 1 ? '' : 's'}`;
}

function guestName(reservation: ReservationNotification) {
  return `${reservation.guestFirstName} ${reservation.guestLastName}`.trim();
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
