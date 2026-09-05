import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { CommunicationEvent } from '../models/CommunicationEvent.js';

let transporter;
function getTransporter() {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) return null;
  if (!transporter) transporter = nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpPort === 465, auth: { user: config.smtpUser, pass: config.smtpPassword } });
  return transporter;
}

export async function sendRecoveryEmail({ merchantId, caseId, to, subject, text, template = 'recovery-payment-link' }) {
  const recipientHash = crypto.createHash('sha256').update(String(to || '')).digest('hex');
  if (!to) {
    await CommunicationEvent.create({ merchantId, caseId, channel: 'email', status: 'suppressed', recipientHash, template, error: 'missing_recipient' });
    return { sent: false, suppressed: true, reason: 'missing_recipient' };
  }
  const transport = getTransporter();
  if (!transport) {
    await CommunicationEvent.create({ merchantId, caseId, channel: 'email', status: 'suppressed', recipientHash, template, error: 'smtp_not_configured' });
    return { sent: false, suppressed: true, reason: 'smtp_not_configured' };
  }
  const result = await transport.sendMail({ from: config.mailFrom, to, subject, text });
  await CommunicationEvent.create({ merchantId, caseId, channel: 'email', status: 'sent', recipientHash, template, providerReference: result.messageId });
  return { sent: true, providerReference: result.messageId };
}
