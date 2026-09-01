export type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};
