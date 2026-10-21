import nodemailer from 'nodemailer';

export function invitationMailer() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_FROM,
    FRONTEND_URL,
  } = process.env;
  if (
    !SMTP_HOST ||
    !SMTP_PORT ||
    !SMTP_USER ||
    !SMTP_PASSWORD ||
    !SMTP_FROM ||
    !FRONTEND_URL
  ) {
    throw new Error('Invitation email is not configured');
  }
  const frontend = new URL(FRONTEND_URL);
  if (
    frontend.protocol !== 'https:' &&
    !(frontend.protocol === 'http:' && frontend.hostname === 'localhost')
  ) {
    throw new Error(
      'FRONTEND_URL must use HTTPS, or localhost for development'
    );
  }
  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid SMTP port');
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  return async (email: string, workspaceId: string) => {
    const link = new URL('/accept-invite', frontend);
    link.searchParams.set('workspaceId', workspaceId);
    const result = await transport.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: 'Invitation to a Kanban Desk team',
      text: `You have been invited to a Kanban Desk team. Sign in or create an account using this email address, then accept your invitation:\n\n${link.href}\n\nThis invitation expires in seven days. Ignore this email if you were not expecting it.`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (!result.accepted.length)
      throw new Error('Mail server did not accept the recipient');
  };
}
