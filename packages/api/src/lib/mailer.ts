import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { env } from '../config/env.js';

interface EmailMessage { to: string; subject: string; html: string; }

interface EmailDriver { send(msg: EmailMessage): Promise<void>; }

const FROM = `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`;

// Console driver — logs instead of sending (local / when SES not configured).
class ConsoleEmailDriver implements EmailDriver {
  async send(msg: EmailMessage): Promise<void> {
    console.log('\n──────── EMAIL (console) ────────');
    console.log(`To: ${msg.to}`);
    console.log(`Subject: ${msg.subject}`);
    console.log('─────────────────────────────────\n');
  }
}

// SES driver — sends via AWS SES using the instance IAM role (or keys).
class SesEmailDriver implements EmailDriver {
  private client: SESClient;
  constructor() {
    this.client = new SESClient({
      region: env.S3_REGION,
      ...(env.S3_ACCESS_KEY && env.S3_SECRET_KEY
        ? { credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } }
        : {}),
    });
  }
  async send(msg: EmailMessage): Promise<void> {
    await this.client.send(new SendEmailCommand({
      Source: FROM,
      Destination: { ToAddresses: [msg.to] },
      Message: {
        Subject: { Data: msg.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: msg.html, Charset: 'UTF-8' } },
      },
    }));
  }
}

const driver: EmailDriver = env.EMAIL_DRIVER === 'ses' ? new SesEmailDriver() : new ConsoleEmailDriver();

// ─── Email verification ─────────────────────────────────────────────────────
export async function sendVerificationEmail(to: string, name: string, verifyUrl: string): Promise<void> {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e11d48;">${env.STORE_NAME}</h2>
      <p>Hi ${name},</p>
      <p>Please verify your email address to activate your account.</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background:#e11d48;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;">
          Verify Email
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">Or paste this link into your browser:<br>${verifyUrl}</p>
    </div>
  `;
  await driver.send({ to, subject: `Verify your ${env.STORE_NAME} account`, html });
}

// ─── Password reset ──────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e11d48;">${env.STORE_NAME}</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background:#e11d48;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;">
          Reset Password
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">Or paste this link into your browser:<br>${resetUrl}</p>
      <p style="color:#6b7280;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
  await driver.send({ to, subject: `Reset your ${env.STORE_NAME} password`, html });
}
