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
      'https://res.cloudinary.com/dfq2nlkxn/image/upload/v1750980514/colibro_logo_mqkt4n.png';

    const sharedHeader = `
    <div style="font-family: 'Segoe UI', sans-serif; background-color: #f4f4f4; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); padding: 40px;">
        <img
          src="${logoUrl}"
          alt="Colibro Logo"
          style="width: 100px; margin: 0 auto 30px; display: block;"
        />
  `;

    const sharedFooter = `
        <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;" />
        <p style="text-align: center; color: #bbb; font-size: 13px;">
          © ${year} Colibro — Helping Writers Succeed with AI.
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
            Welcome to <strong style="color: #5B3DF4;">Colibro</strong> — your AI-powered assistant for writers. To get started, verify your email address using the code below:
          </p>
          <div style="margin: 30px 0; text-align: center;">
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 2px; background-color: #f7f7f7; padding: 18px 24px; border-radius: 10px; display: inline-block; color: #333;">
              ${code}
            </p>
          </div>
          <p style="color: #999; font-size: 14px; text-align: center;">
            This code is valid for the next 15 minutes. If you didn’t request this, you can safely ignore this email.
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
            You requested to reset your password for <strong style="color: #5B3DF4;">Colibro</strong>. Use the code below to proceed:
          </p>
          <div style="margin: 30px 0; text-align: center;">
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 2px; background-color: #f7f7f7; padding: 18px 24px; border-radius: 10px; display: inline-block; color: #333;">
              ${code}
            </p>
          </div>
          <p style="color: #999; font-size: 14px; text-align: center;">
            This code will expire in 15 minutes. If you didn’t request a password reset, you can ignore this email.
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
  // async verifyTokenAndGetPayload<
  //   TPurpose extends 'email-verification' | 'password-reset',
  // >(
  //   token: string,
  //   expectedPurpose: TPurpose,
  //   email?: string,
  // ): Promise<{ email: string; purpose: TPurpose } | null> {
  //   try {
  //     console.log('🔍 Verifying token:', token?.substring(0, 20) + '...');
  //     console.log('🎯 Expected purpose:', expectedPurpose);
  //     console.log('📧 Expected email:', email);

  //     const payload = await this.jwtService.verifyAsync(token, {
  //       secret: process.env.JWT_SECRET,
  //     });

  //     console.log('✅ JWT verification successful');
  //     console.log('📋 Full payload:', JSON.stringify(payload, null, 2));
  //     console.log('🏷️ Payload purpose:', payload.purpose);
  //     console.log('📬 Payload email:', payload.email);

  //     if (payload.purpose !== expectedPurpose) {
  //       console.log('❌ Purpose mismatch:', {
  //         expected: expectedPurpose,
  //         actual: payload.purpose,
  //         comparison: payload.purpose === expectedPurpose,
  //       });
  //       return null;
  //     }

  //     if (email && payload.email !== email) {
  //       console.log('❌ Email mismatch:', {
  //         expected: email,
  //         actual: payload.email,
  //         comparison: payload.email === email,
  //       });
  //       return null;
  //     }

  //     console.log('✅ All validations passed, returning payload');
  //     return payload;
  //   } catch (error) {
  //     console.log('❌ JWT verification failed:', error.message);
  //     console.log('🔧 Error details:', error);
  //     return null;
  //   }
  // }
}
