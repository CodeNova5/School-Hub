export function buildEmailTemplate(subject: string, body: string, schoolName?: string): string {
    const brandColor = "#3B82F6";
    const schoolDisplay = schoolName ?? "School Deck";
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f9fafb;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${brandColor} 0%, #2563EB 100%); color: white; padding: 32px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700;">${schoolDisplay}</h1>
        </div>

        <!-- Content -->
        <div style="padding: 32px 20px;">
            <h2 style="margin-top: 0; margin-bottom: 16px; color: #1f2937; font-size: 22px; font-weight: 600;">${subject}</h2>
            <div style="color: #4b5563; line-height: 1.8; font-size: 14px;">
                ${body.split('\n').map(line => `<p style="margin: 12px 0;">${line || '&nbsp;'}</p>`).join('')}
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 24px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
                This is a message from ${schoolDisplay}. Please do not reply to this email.
            </p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} ${schoolDisplay}. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
}
