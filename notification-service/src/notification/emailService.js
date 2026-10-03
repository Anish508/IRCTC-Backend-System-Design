import sgMail from "@sendgrid/mail";
import config from "../config/index.js";
import logger from "../config/logger.js";
import { renderOtpEmailHtml, renderWelcomeEmailHtml } from "../templates/emailTemplates.js";

/**
 * Singleton EmailService responsible for communicating with SendGrid
 */
class EmailService {
    static #instance = null;

    constructor() {
        if (EmailService.#instance) {
            return EmailService.#instance;
        }

        if (config.SENDGRID_API_KEY && config.SENDGRID_API_KEY.startsWith("SG.")) {
            sgMail.setApiKey(config.SENDGRID_API_KEY);
            logger.info("[EmailService] SendGrid initialized with API key");
        } else {
            logger.warn("[EmailService] SENDGRID_API_KEY not configured. Using console logging fallback for development.");
        }

        EmailService.#instance = this;
    }

    /**
     * Singleton instance accessor
     */
    static getInstance() {
        if (!EmailService.#instance) {
            EmailService.#instance = new EmailService();
        }
        return EmailService.#instance;
    }

    /**
     * Sends an email via SendGrid with dev logging fallback
     * @param {object} options
     * @param {string} options.to - recipient email address
     * @param {string} options.subject - email subject
     * @param {string} [options.html] - HTML body
     * @param {string} [options.text] - Plain text body
     */
    async sendEmail({ to, subject, html, text }) {
        const msg = {
            to,
            from: {
                email: config.EMAIL_FROM || "no-reply@irctc.co.in",
                name: config.EMAIL_FROM_NAME || "IRCTC NextGen e-Ticketing"
            },
            subject,
            text: text || "Your IRCTC notification is enclosed.",
            ...(html ? { html } : {})
        };

        if (config.SENDGRID_API_KEY && config.SENDGRID_API_KEY.startsWith("SG.")) {
            try {
                await sgMail.send(msg);
                logger.info(`[EmailService] Email successfully sent to ${to} via SendGrid`);
                return true;
            } catch (error) {
                const errorDetails = error.response?.body ? JSON.stringify(error.response.body) : error.message;
                logger.error(`[EmailService] SendGrid delivery error for ${to}: ${errorDetails}`);
                // In production, throw so Kafka knows this message failed and can retry
                if (config.NODE_ENV === "production") {
                    throw error;
                }
                // In development fallback, log to console so local testing is never blocked
                this.#logDevFallback({ to, subject, text });
                return true;
            }
        } else {
            this.#logDevFallback({ to, subject, text });
            return true;
        }
    }

    /**
     * Sends OTP verification email
     */
    async sendOtpEmail({ email, firstName = "Passenger", otp }) {
        const subject = `[IRCTC] Your Verification Code: ${otp}`;
        const html = renderOtpEmailHtml({ otp, firstName });
        const text = `Namaste ${firstName},\n\nYour IRCTC verification code is: ${otp}\nDo not share this code with anyone.\n\nIRCTC e-Ticketing Team`;

        return this.sendEmail({ to: email, subject, html, text });
    }

    /**
     * Sends Welcome email
     */
    async sendWelcomeEmail({ email, firstName = "Passenger", lastName = "" }) {
        const subject = "Welcome to IRCTC NextGen e-Ticketing!";
        const html = renderWelcomeEmailHtml({ firstName, lastName });
        const text = `Namaste ${firstName},\n\nWelcome to IRCTC NextGen e-Ticketing!\nYour account has been verified and is ready for use.\n\nHappy Journey!\nIRCTC Ltd.`;

        return this.sendEmail({ to: email, subject, html, text });
    }

    #logDevFallback({ to, subject, text }) {
        logger.info("==========================================================");
        logger.info("[DEV EMAIL DISPATCH - CONSOLE FALLBACK]");
        logger.info(`To: ${to}`);
        logger.info(`Subject: ${subject}`);
        if (text) logger.info(`Body:\n${text}`);
        logger.info("==========================================================");
    }
}

const emailService = EmailService.getInstance();

export const sendEmail = (opts) => emailService.sendEmail(opts);
export const sendOtpEmail = (opts) => emailService.sendOtpEmail(opts);
export const sendWelcomeEmail = (opts) => emailService.sendWelcomeEmail(opts);

export default emailService;
