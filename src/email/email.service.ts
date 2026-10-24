import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger('EmailService');
    private readonly transporter: Transporter | null = null;
    private readonly from: string;

    constructor() {
        const host = process.env.SMTP_HOST;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        this.from = process.env.MAIL_FROM || (user ? `Laxalab <${user}>` : 'Laxalab <no-reply@laxalab.com>');

        if (host && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port: Number(process.env.SMTP_PORT || 587),
                secure: process.env.SMTP_SECURE === 'true',
                auth: { user, pass },
            });
            this.logger.log(`Email transport configured via SMTP (${host})`);
        } else {
            this.logger.warn(
                'SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). Emails will be logged to the console instead.'
            );
        }
    }

    private async send(to: string, subject: string, html: string): Promise<boolean> {
        if (!this.transporter) {
            this.logger.verbose(`[DEV] Email to ${to} | Subject: ${subject}\n${html}`);
            return false;
        }
        try {
            await this.transporter.sendMail({ from: this.from, to, subject, html });
            this.logger.log(`Email sent to ${to} (${subject})`);
            return true;
        } catch (err) {
            this.logger.error(`Failed to send email to ${to} (${subject})`, err as Error);
            return false;
        }
    }

    private layout(title: string, body: string): string {
        const safe = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
        <!DOCTYPE html>
        <html dir="auto" lang="en">
        <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safe(title)}</title></head>
        <body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif;color:#17222b">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 12px">
            <tr><td align="center">
              <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6ebf0">
                <tr style="background:#0f2a43">
                  <td style="padding:28px 32px;text-align:center">
                    <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:1px">LAXALAB</span>
                  </td>
                </tr>
                <tr><td style="padding:32px">
                  <h1 style="margin:0 0 12px;font-size:20px;color:#0f2a43">${safe(title)}</h1>
                  ${body}
                </td></tr>
                <tr style="background:#f9fbfc">
                  <td style="padding:20px 32px;text-align:center;color:#8a97a3;font-size:12px">
                    &copy; ${new Date().getFullYear()} Laxalab. All rights reserved.
                  </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>`;
    }

    private actionButton(url: string, label: string): string {
        const safeUrl = url.replace(/"/g, '%22');
        return `<p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;padding:13px 28px;background:#0f2a43;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700">${label}</a></p>`;
    }

    async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
        const html = this.layout(
            'Reset your password',
            `<p style="color:#3d4a56;line-height:1.7">We received a request to reset your password. Click the button below within 1 hour to choose a new password. If you did not request this, you can ignore this email.</p>${this.actionButton(resetUrl, 'Reset password')}`
        );
        await this.send(to, 'Reset your Laxalab password', html);
    }

    async sendEmailVerification(to: string, verifyUrl: string): Promise<void> {
        const html = this.layout(
            'Verify your email address',
            `<p style="color:#3d4a56;line-height:1.7">Welcome to Laxalab. Please confirm your email address by clicking the button below to secure your account and start learning.</p>${this.actionButton(verifyUrl, 'Verify my email')}`
        );
        await this.send(to, 'Verify your email — Laxalab', html);
    }

    async sendNotification(to: string, subject: string, body: string, actionUrl?: string, actionLabel?: string): Promise<void> {
        const action = actionUrl && actionLabel ? this.actionButton(actionUrl, actionLabel) : '';
        const html = this.layout(subject, `<p style="color:#3d4a56;line-height:1.7">${body.replace(/\n/g, '<br/>')}</p>${action}`);
        await this.send(to, `${subject} — Laxalab`, html);
    }

    /** Bilingual (AR + EN) notification email using the notification's localized fields. */
    async sendLocalized(
        to: string,
        subjectAr: string,
        bodyAr: string,
        subjectEn: string,
        bodyEn: string,
        actionUrl?: string,
        actionLabelAr?: string,
        actionLabelEn?: string,
    ): Promise<void> {
        let action = '';
        if (actionUrl && (actionLabelAr || actionLabelEn)) {
            const label = [actionLabelAr, actionLabelEn].filter(Boolean).join(' / ');
            action = this.actionButton(actionUrl, label);
        }
        const html = this.layout(
            `${subjectEn} | ${subjectAr}`,
            `<div dir="rtl" lang="ar" style="border-bottom:1px solid #e6ebf0;padding-bottom:16px;margin-bottom:16px">
              <div style="font-weight:700;color:#0f2a43;margin-bottom:6px">${subjectAr}</div>
              <p style="color:#3d4a56;line-height:1.7;margin:0">${(bodyAr || '').replace(/\n/g, '<br/>')}</p>
            </div>
            <div dir="ltr" lang="en" style="padding-bottom:16px">
              <div style="font-weight:700;color:#0f2a43;margin-bottom:6px">${subjectEn}</div>
              <p style="color:#3d4a56;line-height:1.7;margin:0">${(bodyEn || '').replace(/\n/g, '<br/>')}</p>
            </div>
            ${action}`
        );
        await this.send(to, `${subjectEn} | ${subjectAr} — Laxalab`, html);
    }

    /** Contact-form message routed to the configured admin inbox (dev-logged when unconfigured). */
    async sendContactEmail(fromEmail: string, name: string, subject: string, message: string): Promise<void> {
        const escape = (s: string) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const adminEmail = process.env.ADMIN_EMAIL;
        if (!adminEmail) {
            this.logger.verbose(`[DEV] Contact form from ${fromEmail} | ${subject}\n${message}`);
            return;
        }
        const html = this.layout(
            'Contact form submission',
            `<p><strong>Name:</strong> ${escape(name)}</p>
             <p><strong>Email:</strong> ${escape(fromEmail)}</p>
             <p><strong>Subject:</strong> ${escape(subject)}</p>
             <p style="color:#3d4a56;line-height:1.7">${escape(message).replace(/\n/g, '<br/>')}</p>`
        );
        await this.send(adminEmail, `Contact: ${escape(subject) || 'Message'} — Laxalab`, html);
    }
}