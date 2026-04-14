import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendDailySMS({ toPhone, toName, count }) {
  await client.messages.create({
    body: `Hi ${toName}, you have ${count} new mail item${count !== 1 ? 's' : ''} waiting at Metrowest Shipping. Log in to your mailbox portal to view and manage your mail.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toPhone,
  });
}
