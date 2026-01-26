import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { google } from "googleapis";

export const GmailOTPPasswordReset = {
  id: "gmail-otp-reset",

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

    try {
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });
    } catch (err: any) {
      console.error(
        "[GmailOTPPasswordReset] Gmail API error:",
        err?.response?.data ?? err
      );
      const details =
        err?.response?.data?.error?.message ??
        err?.message ??
        "Erro desconhecido ao enviar via Gmail API";
      throw new Error("Falha ao enviar e-mail via Gmail API: " + details);
    }
  },
};
