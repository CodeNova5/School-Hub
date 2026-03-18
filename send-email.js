import nodemailer from 'nodemailer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GMAIL_USER = 'netdot1234@gmail.com';
const GMAIL_APP_PASSWORD = 'ifbi ytvw wxcv wrsj';
const EMAIL_TO = 'nonyeluekene09@gmail.com';

async function sendEmail() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  // Verifies SMTP connection settings before sending.
  await transporter.verify();

  const info = await transporter.sendMail({
    from: `School Hub <${GMAIL_USER}>`,
    to: EMAIL_TO,
    subject: 'Nodemailer Gmail Test',
    text: 'Hello! This is a test email sent with Nodemailer using Gmail service.',
    html: '<p>Hello! This is a <b>test email</b> sent with Nodemailer using Gmail service.</p>',
  });

  console.log('Email sent successfully.');
  console.log('Message ID:', info.messageId);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  sendEmail().catch((error) => {
    console.error('Failed to send email:', error.message);
    process.exit(1);
  });
}

export { sendEmail };
