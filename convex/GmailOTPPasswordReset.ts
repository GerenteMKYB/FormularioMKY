"use node";

import { google } from "googleapis";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const GmailOTPPasswordReset = {
  id: "gmail-otp-reset",
  type: "email" as const, // <- ESSENCIAL (não pode ser string genérico)
  name: "Gmail OTP Reset",

  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 6);
  },

  async sendVerificationRequest({
    identifier: email,
    token,
  }: {
    identifier: string;
    token: string;
    provider?: unknown;
  }) {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const sender = process.env.GMAIL_SENDER_EMAIL;

    if (!clientId || !clientSecret || !refreshToken || !sender) {
      throw new Error(
        "Gmail OTP: variáveis ausentes. Defina GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN e GMAIL_SENDER_EMAIL no Convex."
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const subject = "Redefinição de senha — Make Your Bank";
    const text =
      "Recebemos uma solicitação para redefinir sua senha.\n\n" +
      `Código de verificação: ${token}\n\n` +
      "Se você não solicitou, ignore este e-mail.";

    const rawMessage = [
      `From: "MKY" <${sender}>`,
      `To: <${email}>`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      `Subject: ${subject}`,
      "",
      text,
    ].join("\r\n");

    const raw = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
  },
};
