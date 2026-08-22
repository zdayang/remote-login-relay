import nodemailer from 'nodemailer';

const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export function smtpOptions(env = process.env) {
  const host = String(env.REMOTE_RELAY_SMTP_HOST || '').trim();
  const from = String(env.REMOTE_RELAY_SMTP_FROM || '').trim();
  const to = String(env.REMOTE_RELAY_NOTIFY_TO || '').trim();
  if (!host) throw new Error('Email is not configured: set REMOTE_RELAY_SMTP_HOST. Run scripts/setup.sh.');
  if (!from) throw new Error('Email is not configured: set REMOTE_RELAY_SMTP_FROM. Run scripts/setup.sh.');
  if (!to) throw new Error('Email is not configured: set REMOTE_RELAY_NOTIFY_TO. Run scripts/setup.sh.');
  if (!emailPattern.test(from)) throw new Error('REMOTE_RELAY_SMTP_FROM must be an email address.');
  if (to.split(',').some((value) => !emailPattern.test(value.trim()))) throw new Error('REMOTE_RELAY_NOTIFY_TO must contain valid email address(es).');

  const port = Number(env.REMOTE_RELAY_SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('REMOTE_RELAY_SMTP_PORT must be a valid TCP port.');
  const user = String(env.REMOTE_RELAY_SMTP_USER || '').trim();
  const password = String(env.REMOTE_RELAY_SMTP_PASSWORD || '');
  if (user && !password) throw new Error('Email password is missing. Re-run scripts/setup.sh or set REMOTE_RELAY_SMTP_PASSWORD for this run.');

  return {
    host,
    port,
    secure: truthy(env.REMOTE_RELAY_SMTP_SECURE) || port === 465,
    requireTLS: truthy(env.REMOTE_RELAY_SMTP_REQUIRE_TLS),
    auth: user ? {user, pass: password} : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {rejectUnauthorized: !truthy(env.REMOTE_RELAY_SMTP_ALLOW_INVALID_CERT)},
  };
}

export function createTransport(env = process.env) {
  return nodemailer.createTransport(smtpOptions(env));
}

export async function sendRelayEmail({link, env = process.env, subject = 'ToolArks · Chrome login needed'}) {
  if (!link || !/^https:\/\//i.test(link)) throw new Error('The temporary login link must use HTTPS.');
  const transport = createTransport(env);
  const to = String(env.REMOTE_RELAY_NOTIFY_TO).split(',').map((value) => value.trim()).filter(Boolean);
  const safeLink = escapeHtml(link);
  try {
    await transport.verify();
    return await transport.sendMail({
      from: env.REMOTE_RELAY_SMTP_FROM,
      to,
      subject,
      text: [
        'ToolArks Remote Login Relay',
        '',
        'A human login step is waiting in your Chrome tab.',
        'Open this temporary link on your phone to finish it:',
        link,
        '',
        'The link expires with the current handoff. Do not forward it.',
      ].join('\n'),
      html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.55;color:#202124"><h2>ToolArks · Remote Login Relay</h2><p>A human login step is waiting in your Chrome tab.</p><p><a href="${safeLink}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px">Open the login page on your phone</a></p><p style="word-break:break-all;color:#555">${safeLink}</p><p>This temporary link expires with the current handoff. Do not forward it.</p></body></html>`,
    });
  } finally {
    transport.close();
  }
}

export async function sendTestEmail({env = process.env} = {}) {
  const transport = createTransport(env);
  const to = String(env.REMOTE_RELAY_NOTIFY_TO).split(',').map((value) => value.trim()).filter(Boolean);
  try {
    await transport.verify();
    return await transport.sendMail({
      from: env.REMOTE_RELAY_SMTP_FROM,
      to,
      subject: 'ToolArks · self-hosted email test',
      text: 'ToolArks self-hosted email test\n\nYour ToolArks Remote Login Relay email configuration is working. No login link was created by this test.',
    });
  } finally {
    transport.close();
  }
}
