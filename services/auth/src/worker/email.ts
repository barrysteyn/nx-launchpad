import { sendEmail as utilSendEmail, type SendEmailResult } from 'utils-node';
import type { Bindings } from './types';

interface SendEmailArgs {
  to: string;
  subject: string;
  url: string;
}

export function sendEmail(
  args: SendEmailArgs,
  env: Bindings,
): Promise<SendEmailResult> {
  return utilSendEmail({
    from: env.FROM_EMAIL,
    to: args.to,
    subject: args.subject,
    text: args.url,
    html: `<p>Click the link below to continue:</p><p><a href="${args.url}">${args.url}</a></p>`,
    aws: {
      accessKeyId: env.AWS_SES_ACCESS_KEY,
      secretAccessKey: env.AWS_SES_SECRET_KEY,
      region: env.AWS_SES_REGION,
    },
  });
}
