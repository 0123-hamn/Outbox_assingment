import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { decrypt } from '../../utils/crypto.js';

export interface ISmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  pass?: string;
}

export interface ISendEmailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

export class EmailService {
  private static defaultTransporter: Transporter | null = null;

  /**
   * Get or create a transporter for default Ethereal credentials
   */
  public static async getDefaultTransporter(): Promise<Transporter> {
    if (this.defaultTransporter) {
      return this.defaultTransporter;
    }

    let user = config.ETHEREAL_USER;
    let pass = config.ETHEREAL_PASS;

    // If Ethereal credentials are not configured in environment, auto-create one!
    if (!user || !pass) {
      try {
        logger.info('ETHEREAL_USER or ETHEREAL_PASS not found, auto-generating test account...');
        const testAccount = await nodemailer.createTestAccount();
        user = testAccount.user;
        pass = testAccount.pass;
        logger.info(`Generated temporary Ethereal account: ${user}`);
      } catch (err: any) {
        logger.warn(`Could not create test account: ${err.message}. Using fallback credentials.`);
      }
    }

    this.defaultTransporter = nodemailer.createTransport({
      host: config.ETHEREAL_HOST,
      port: config.ETHEREAL_PORT,
      secure: config.ETHEREAL_PORT === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    return this.defaultTransporter;
  }

  /**
   * Build transporter for custom sender SMTP configuration if available
   */
  public static createTransporterForSender(smtpConfigEnc?: string | null): Transporter | null {
    if (!smtpConfigEnc) return null;
    try {
      const decrypted = decrypt(smtpConfigEnc);
      if (!decrypted) return null;
      const parsed: ISmtpConfig = JSON.parse(decrypted);

      return nodemailer.createTransport({
        host: parsed.host || config.ETHEREAL_HOST,
        port: parsed.port || config.ETHEREAL_PORT,
        secure: parsed.secure || parsed.port === 465,
        auth: parsed.user && parsed.pass ? { user: parsed.user, pass: parsed.pass } : undefined,
      });
    } catch (err: any) {
      logger.warn(`Failed to parse custom SMTP configuration: ${err.message}`);
      return null;
    }
  }

  /**
   * Send email using either custom sender configuration or Ethereal fallback
   */
  public static async sendMail(options: {
    fromName: string;
    fromEmail: string;
    to: string;
    subject: string;
    body: string;
    smtpConfigEnc?: string | null;
  }): Promise<ISendEmailResult> {
    try {
      let transporter = this.createTransporterForSender(options.smtpConfigEnc);
      if (!transporter) {
        transporter = await this.getDefaultTransporter();
      }

      const info = await transporter.sendMail({
        from: `"${options.fromName}" <${options.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.body,
        html: options.body.replace(/\n/g, '<br/>'),
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`Email sent to ${options.to} - Preview URL: ${previewUrl}`);
      } else {
        logger.info(`Email sent to ${options.to} - MessageId: ${info.messageId}`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
      };
    } catch (err: any) {
      logger.error(`Error sending email to ${options.to}: ${err.message}`);
      return {
        success: false,
        error: err.message || 'SMTP delivery failed',
      };
    }
  }
}
