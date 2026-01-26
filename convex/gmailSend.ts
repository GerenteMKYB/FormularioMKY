"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { google } from "googleapis";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function toBase64Url(str: string) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export const sendResetCodeEmail = action({
  args: {
    to: v.string(),
    code: v.string(),
  },
  handler: async (_ctx, { to, code }) => {
    const clientId = requireEnv("GMAIL_CLIENT_ID");
    const clientSecret = requireEnv("GMAIL_CLIENT_SECRET");
    const refreshToken = requireEnv("GMAIL_REFRESH_TOKEN");
    const sender = requireEnv("GMAIL_SENDER_EMAIL");

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const subject = "Redefinição de senha — Make Your Bank";
    const text =
      "Recebemos uma solicitação para redefinir sua senha.\n\n" +
      `Código de verificação: ${code}\n\n` +
      "Se você não solicitou, ignore este e-mail.";

    const rawMessage = [
      `From: "MKY" <${sender}>`,
      `To: <${to}>`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      `Subject: ${subject}`,
      "",
      text,
    ].join("\r\n");

    const raw = toBase64Url(rawMessage);

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return { ok: true };
  },
});
