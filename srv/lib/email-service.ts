import { sendMail, MailConfig } from '@sap-cloud-sdk/mail-client';
import cds from '@sap/cds';

/**
 * Email service that uses the official SAP Cloud SDK mail-client approach.
 * Reference: https://learning.sap.com/learning-journeys/develop-advanced-extensions-with-sap-cloud-sdk/sending-email-using-sap-cloud-sdk_fce16eb8-20d3-4bb0-b657-f96decf220eb
 *
 * Requires a BTP MAIL destination named 'cnma_fxrequest_mail' configured in SAP BTP Cockpit
 * with the following Additional Properties:
 *   mail.smtp.host, mail.smtp.port, mail.user, mail.password,
 *   mail.smtp.auth=true, mail.smtp.starttls.enable=true
 */

const DESTINATION_NAME = 'cnma_fxrequest_mail';

export interface EmailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export class EmailService {
    private static log = cds.log('email-service');

    /**
     * Sends a single email via the SAP Cloud SDK sendMail API.
     * The BTP Destination handles all SMTP credentials securely.
     */
    static async sendMail(options: EmailOptions): Promise<boolean> {
        try {
            this.log.info(`Sending email to "${options.to}" via destination "${DESTINATION_NAME}"`);

            // Build a MailConfig object as described in the SAP Cloud SDK guide (Step 3)
            const mailConfig: MailConfig = {
                from: undefined, // will be filled from destination's mail.smtp.from / mail.user
                to: options.to,
                subject: options.subject,
                text: options.text,
                ...(options.html ? { html: options.html } : {})
            };

            // sendMail(destination, [mailConfigs])
            // The SDK reads all SMTP credentials directly from the BTP destination,
            // so we do NOT need to manually extract host/port/user/pass here.
            await sendMail({ destinationName: DESTINATION_NAME }, [mailConfig]);

            this.log.info(`Email successfully sent to "${options.to}"`);
            return true;

        } catch (error: any) {
            this.log.error(`Failed to send email to "${options.to}": ${error.message}`);
            return false;
        }
    }

    /**
     * Sends multiple emails in a single call (parallel by default).
     * Pass sdkOptions.parallel = false to send sequentially.
     */
    static async sendMailBatch(emails: EmailOptions[], parallel = true): Promise<boolean> {
        try {
            this.log.info(`Sending ${emails.length} email(s) via destination "${DESTINATION_NAME}"`);

            const mailConfigs: MailConfig[] = emails.map(opt => ({
                to: opt.to,
                subject: opt.subject,
                text: opt.text,
                ...(opt.html ? { html: opt.html } : {})
            }));

            // Step 4 from SAP guide: sending multiple emails
            await sendMail(
                { destinationName: DESTINATION_NAME },
                mailConfigs,
                { sdkOptions: { parallel } }
            );

            this.log.info(`${emails.length} email(s) sent successfully`);
            return true;

        } catch (error: any) {
            this.log.error(`Failed to send batch emails: ${error.message}`);
            return false;
        }
    }
}