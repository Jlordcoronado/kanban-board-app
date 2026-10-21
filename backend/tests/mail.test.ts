import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { invitationMailer } from '../src/mail.js';

test('invitation mail uses the recipient email and safe callback, and reports rejection', async () => {
  const settings = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_USER: 'test-user',
    SMTP_PASSWORD: 'test-password',
    SMTP_FROM: 'noreply@example.com',
    FRONTEND_URL: 'https://app.example.com',
  };
  const original = Object.fromEntries(
    Object.keys(settings).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, settings);
  let sent: any;
  let rejected = false;
  const transport = mock.method(nodemailer, 'createTransport', (() => ({
    sendMail: async (options: any) => {
      sent = options;
      return { accepted: rejected ? [] : ['recipient@example.com'] };
    },
  })) as any);
  try {
    await invitationMailer()('recipient@example.com', 'team-id');
    assert.equal(sent.to, 'recipient@example.com');
    assert.ok(
      sent.text.includes(
        'https://app.example.com/accept-invite?workspaceId=team-id'
      )
    );
    assert.ok(sent.text.includes('Sign in or create an account'));
    assert.equal(sent.disableFileAccess, true);
    rejected = true;
    await assert.rejects(
      invitationMailer()('recipient@example.com', 'team-id')
    );
    process.env.FRONTEND_URL = 'http://public.example.com';
    assert.throws(() => invitationMailer());
    delete process.env.SMTP_HOST;
    assert.throws(() => invitationMailer());
  } finally {
    transport.mock.restore();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
