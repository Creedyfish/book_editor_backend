import * as nodemailer from 'nodemailer';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private getEmailContent(
    code: string,
    purpose: 'email-verification' | 'password-reset',
  ) {
    const year = new Date().getFullYear();
    const logoUrl =
      'https://dv1i48yg0n78o.cloudfront.net/assets/logos/Scriblaheim-logo.png';

    const sharedHeader = `
    <div style="font-family: 'Segoe UI', sans-serif; background-color: #f4f4f4; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); padding: 40px;">
        <img
          src="${logoUrl}"
          alt="Scriblaheim Logo"
          style="width: 100px; margin: 0 auto 30px; display: block;"
        />
  `;

    const sharedFooter = `
        <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;" />
        <p style="text-align: center; color: #bbb; font-size: 13px;">
          © ${year} Scriblaheim — A Community for Writers and Readers.
        </p>
      </div>
    </div>
  `;

    switch (purpose) {
      case 'email-verification':
        return {
          subject: 'Verify Your Email',
          html: `
          ${sharedHeader}
          <h2 style="color: #222; text-align: center; font-size: 24px; margin-bottom: 10px;">
            Verify Your Email Address
          </h2>
          <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center;">
            Welcome to <strong style="color: #5B3DF4;">Scriblaheim</strong> — your new home for writing, publishing, and discovering novels. To get started, please confirm your email address with the code below:
          </p>
          <div style="margin: 30px 0; text-align: center;">
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 2px; background-color: #f7f7f7; padding: 18px 24px; border-radius: 10px; display: inline-block; color: #333;">
              ${code}
            </p>
          </div>
          <p style="color: #999; font-size: 14px; text-align: center;">
            This code is valid for the next 15 minutes. If you didn’t create an account, you can safely ignore this email.
          </p>
          ${sharedFooter}
        `,
        };

      case 'password-reset':
        return {
          subject: 'Reset Your Password',
          html: `
          ${sharedHeader}
          <h2 style="color: #222; text-align: center; font-size: 24px; margin-bottom: 10px;">
            Reset Your Password
          </h2>
          <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center;">
            You requested to reset your password for <strong style="color: #5B3DF4;">Scriblaheim</strong>. Use the code below to set up a new password and continue your journey in reading and writing:
          </p>
          <div style="margin: 30px 0; text-align: center;">
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 2px; background-color: #f7f7f7; padding: 18px 24px; border-radius: 10px; display: inline-block; color: #333;">
              ${code}
            </p>
          </div>
          <p style="color: #999; font-size: 14px; text-align: center;">
            This code will expire in 15 minutes. If you didn’t request a password reset, you can safely ignore this email.
          </p>
          ${sharedFooter}
        `,
        };

      default:
        throw new Error('Unknown email purpose');
    }
  }

  constructor(private readonly jwtService: JwtService) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false, // false for TLS (port 587)
      auth: {
        user: 'resend',
        pass: process.env.RESEND_SMTP_KEY, // your Resend SMTP API key
      },
    });
  }

  async sendCodeEmail(
    to: string,
    code: string,
    purpose: 'email-verification' | 'password-reset',
  ) {
    const { subject, html } = this.getEmailContent(code, purpose);

    const mailOptions = {
      from: 'noreply@mail.ielbanbuena.online',
      to,
      subject,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error(error);
    }
  }

  async generateEmailToken(
    email: string,
    purpose: 'email-verification' | 'password-reset',
  ) {
    const payload = { email, purpose };

    return await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '10m',
    });
  }

  async verifyTokenAndGetPayload<
    TPurpose extends 'email-verification' | 'password-reset',
  >(
    token: string,
    expectedPurpose: TPurpose,
    email?: string,
  ): Promise<{ email: string; purpose: TPurpose } | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      if (payload.purpose !== expectedPurpose) {
        return null;
      }

      if (email && payload.email !== email) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }
}
