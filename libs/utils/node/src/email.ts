import { AwsClient } from 'aws4fetch';

export interface Attachment {
  filename: string;
  contentType: string;
  /** Base64-encoded content (no `data:` prefix). */
  content: string;
}

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface SendEmailOptions {
  /** RFC 5322 from. Either a bare address (`a@b.com`) or display form (`"Name" <a@b.com>`). */
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Attachment[];
  /** e.g. `mailto:unsubscribe@example.com` or `<https://example.com/u>`. Adds the one-click POST header too. */
  listUnsubscribe?: string;
  aws: AwsCredentials;
}

export interface SendEmailResult {
  messageId: string;
}

const DEFAULT_REGION = 'us-east-1';
const SES_MAX_RAW_BYTES = 9_500_000;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
};

export const sendEmail = async (
  opts: SendEmailOptions,
): Promise<SendEmailResult> => {
  const {
    from,
    to,
    subject,
    text,
    html,
    attachments = [],
    listUnsubscribe,
    aws,
  } = opts;
  const region = aws.region ?? DEFAULT_REGION;

  const { createMimeMessage } = await import('mimetext');
  const msg = createMimeMessage();
  msg.setSender(from);
  msg.setRecipient(to);
  msg.setSubject(subject);
  msg.addMessage({ contentType: 'text/plain', data: text });
  if (html) {
    msg.addMessage({ contentType: 'text/html', data: html });
  }
  for (const att of attachments) {
    msg.addAttachment({
      filename: att.filename,
      contentType: att.contentType,
      data: att.content,
    });
  }
  if (listUnsubscribe) {
    msg.setHeader('List-Unsubscribe', listUnsubscribe);
    msg.setHeader('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
  }

  const rawBytes = new TextEncoder().encode(msg.asRaw());
  if (rawBytes.byteLength > SES_MAX_RAW_BYTES) {
    throw new Error(
      `Email too large for SES (raw ~${Math.round(rawBytes.byteLength / 1024)} KB)`,
    );
  }
  const rawBase64 = bytesToBase64(rawBytes);

  const sender = msg.getSender();
  const fromEmail = sender ? sender.addr : from;

  const client = new AwsClient({
    accessKeyId: aws.accessKeyId,
    secretAccessKey: aws.secretAccessKey,
    service: 'ses',
    region,
  });

  const endpoint = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;
  const res = await client.fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      FromEmailAddress: fromEmail,
      Destination: { ToAddresses: [to] },
      Content: { Raw: { Data: rawBase64 } },
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`SES v2 error ${res.status}: ${body}`);
  }
  const parsed = JSON.parse(body) as { MessageId?: string };
  if (!parsed.MessageId) {
    throw new Error(`SES v2 response missing MessageId: ${body}`);
  }
  return { messageId: parsed.MessageId };
};
