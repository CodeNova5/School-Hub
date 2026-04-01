import { Resend } from 'resend';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_TO = process.env.EMAIL_TO;

async function sendEmail() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY in environment.');
  }

  if (!EMAIL_TO) {
    throw new Error('Missing EMAIL_TO in environment.');
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const fromName = process.env.RESEND_FROM_NAME || 'School Deck';

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: EMAIL_TO,
    subject: 'School Deck Resend Test',
    text: 'Hello! This is a test email sent with Resend.',
    html: '<p>Hello! This is a <b>test email</b> sent with Resend for School Deck.</p>',
  });

  if (error) {
    throw new Error(error.message || 'Resend failed to send message.');
  }

  console.log('Email sent successfully.');
  console.log('Message ID:', data?.id);
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
