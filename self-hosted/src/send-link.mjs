import {sendRelayEmail} from './email.mjs';

const link = process.argv[2];
if (!link) {
  console.error('Usage: node src/send-link.mjs <https-link>');
  process.exit(2);
}

try {
  const result = await sendRelayEmail({link});
  console.log(`Login link email sent: ${result.messageId || 'accepted by SMTP server'}`);
} catch (error) {
  console.error(`Login link email failed: ${error.message}`);
  process.exit(1);
}
