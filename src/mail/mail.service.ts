import * as nodemailer from 'nodemailer';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

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

  async sendVerificationCode(to: string, code: string) {
    const mailOptions = {
      from: 'noreply@mail.ielbanbuena.online', // must match verified domain in Resend
      to,
      subject: 'Your Verification Code',
      html: `<p>Your verification code is: <strong>${code}</strong></p>`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error(error);
    }
  }
  async generateEmailToken(email: string) {
    const payload = { email, purpose: 'email-verification' };

    return await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '10m',
    });
  }

  async verifyEmailTokenAndGetPayload(
    token: string,
    email?: string,
  ): Promise<{ email: string; purpose: string } | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // Check if the token is for email verification
      if (payload.purpose !== 'email-verification') {
        return null;
      }

      // If email is provided, verify it matches the token
      if (email && payload.email !== email) {
        return null;
      }

      return payload;
    } catch (error) {
      // Token is invalid, expired, or malformed
      return null;
    }
  }
}
