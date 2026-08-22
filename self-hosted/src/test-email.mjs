import {sendTestEmail} from './email.mjs';

try {
  const result = await sendTestEmail();
  console.log(`Test email sent: ${result.messageId || 'accepted by SMTP server'}`);
} catch (error) {
  console.error(`Test email failed: ${error.message}`);
  process.exit(1);
}
