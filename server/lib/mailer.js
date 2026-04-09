import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

export async function sendDailySummary({ toEmail, toName, count }) {
  await transporter.sendMail({
    from: `"Metrowest Shipping" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `You have ${count} new mail item${count !== 1 ? 's' : ''} today`,
    text: `Hi ${toName},

Here's your mail summary for today:

Total mail received: ${count}

To view your uploaded mails, click the digitalmailbox-production.up.railway.app 
Thank you for using our service. If you have any questions, feel free to reach out.

Best regards,
Metrowest Shipping Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <div style="background: #2563eb; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: white; margin: 0; font-size: 18px;">Metrowest Shipping</h2>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 16px;">Hi <strong>${toName}</strong>,</p>
          <p style="margin: 0 0 16px;">Here's your mail summary for today:</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin: 0 0 20px; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Total Mail Received</p>
            <p style="margin: 6px 0 0; font-size: 36px; font-weight: bold; color: #2563eb;">${count}</p>
          </div>
          <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">To view your uploaded mails, click the digitalmailbox-production.up.railway.app .</p>
          <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Thank you for using our service. If you have any questions, feel free to reach out.</p>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Best regards,<br><strong style="color: #1f2937;">Metrowest Shipping Team</strong></p>
        </div>
      </div>
    `,
  });
}
