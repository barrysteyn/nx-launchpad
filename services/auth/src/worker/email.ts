import { sendEmail, type SendEmailResult } from 'utils-node';
import type { Bindings } from './types';

interface SendEmailOptions {
  to: string;
  subject: string;
  url: string;
}

export function sendSESEmail(
  opts: SendEmailOptions,
  env: Bindings,
): Promise<SendEmailResult> {
  return sendEmail({
    from: env.FROM_EMAIL,
    to: opts.to,
    subject: opts.subject,
    text: opts.url,
    html: `<p>Click the link below to continue:</p><p><a href="${opts.url}">${opts.url}</a></p>`,
    aws: {
      accessKeyId: env.AWS_SES_ACCESS_KEY,
      secretAccessKey: env.AWS_SES_SECRET_KEY,
      region: env.AWS_SES_REGION,
    },
  });
}
