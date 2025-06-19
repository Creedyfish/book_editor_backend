import * as nodemailer from 'nodemailer';
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
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
}
