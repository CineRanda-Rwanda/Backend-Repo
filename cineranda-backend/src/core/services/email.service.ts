import axios from 'axios';

interface SendEmailPayload {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export class EmailService {
  private apiKey: string;
  private senderEmail: string;
  private senderName?: string;

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY || '';
    this.senderEmail = process.env.BREVO_SENDER_EMAIL || '';
    this.senderName = process.env.BREVO_SENDER_NAME || undefined;

    if (!this.apiKey || !this.senderEmail) {
      console.warn('Brevo email service is not fully configured. Emails will not be sent.');
    }
  }

  async sendEmail(payload: SendEmailPayload): Promise<void> {
    if (!this.apiKey || !this.senderEmail) {
      console.log('[EMAIL] Skipping send; Brevo credentials missing.');
      return;
    }

    const requestBody = {
      sender: {
        email: this.senderEmail,
        name: this.senderName || this.senderEmail,
      },
      to: payload.to,
      subject: payload.subject,
      htmlContent: payload.htmlContent,
      textContent: payload.textContent,
    };

    await axios.post('https://api.brevo.com/v3/smtp/email', requestBody, {
      headers: {
        accept: 'application/json',
        'api-key': this.apiKey,
        'content-type': 'application/json',
      },
    });
  }

  async sendVerificationEmail(email: string, token: string) {
    const verifyUrl = `${process.env.CLIENT_URL || 'https://randaplus.com'}/verify-email?token=${token}`;

    await this.sendEmail({
      to: [{ email }],
      subject: 'Verify your Randa Plus account',
      htmlContent: `<p>Welcome to Randa Plus!</p><p>Please verify your email by clicking <a href="${verifyUrl}">here</a>.</p>`,
      textContent: `Welcome to Randa Plus! Verify your account: ${verifyUrl}`,
    });
  }

  async sendEmailVerificationCode(email: string, code: string, username?: string) {
    const safeName = username?.trim() || 'there';
    const expiresMinutes = 10;
    const supportEmail = process.env.SUPPORT_EMAIL?.trim();
    const clientUrl = process.env.CLIENT_URL || 'https://randaplus.com';
    const supportHtml = supportEmail
      ? `<p>If you didn’t initiate this request, please ignore this message or contact us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>`
      : '<p>If you didn’t initiate this request, please ignore this message.</p>';
    const supportText = supportEmail
      ? ` If you didn’t start this signup, ignore this email or contact ${supportEmail}.`
      : ' If you didn’t start this signup, simply ignore this email.';

    await this.sendEmail({
      to: [{ email }],
      subject: 'Complete your Randa Plus signup',
      htmlContent: `
        <p>Hello ${safeName},</p>
        <p>Thanks for signing up for <strong>Randa Plus</strong>! To finish creating your account, enter the verification code below in the app or at <a href="${clientUrl}">${clientUrl}</a>.</p>
        <p style="font-size:20px;font-weight:bold;letter-spacing:3px;">${code}</p>
        <p>This code expires in ${expiresMinutes} minutes. If it expires, request a new one from the signup screen.</p>
        ${supportHtml}
        <p>— The Randa Plus Team</p>
      `,
      textContent: `Hello ${safeName}, your Randa Plus verification code is ${code}. It expires in ${expiresMinutes} minutes. Enter it in the app or at ${clientUrl}.${supportText}`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.CLIENT_URL || 'https://randaplus.com'}/reset-password?token=${token}`;

    await this.sendEmail({
      to: [{ email }],
      subject: 'Reset your Randa Plus password',
      htmlContent: `<p>Need to reset your password?</p><p>Use this link: <a href="${resetUrl}">${resetUrl}</a></p>`,
      textContent: `Reset your Randa Plus password: ${resetUrl}`,
    });
  }
}