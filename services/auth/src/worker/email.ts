import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { Bindings } from './types';

interface SendEmailOptions {
  to: string;
  subject: string;
  url: string;
}

export function sendSESEmail(
  opts: SendEmailOptions,
  env: Bindings,
): Promise<unknown> {
  const client = new SESClient({
    region: env.AWS_SES_REGION,
    credentials: {
      accessKeyId: env.AWS_SES_ACCESS_KEY,
      secretAccessKey: env.AWS_SES_SECRET_KEY,
    },
  });
  return client.send(
    new SendEmailCommand({
      Source: env.FROM_EMAIL,
      Destination: { ToAddresses: [opts.to] },
      Message: {
        Subject: { Data: opts.subject },
        Body: {
          Html: {
            Data: `<p>Click the link below to continue:</p><p><a href="${opts.url}">${opts.url}</a></p>`,
          },
          Text: { Data: opts.url },
        },
      },
    }),
  );
}
