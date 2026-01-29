import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Encode header values (e.g., Subject) with RFC 2047 when non-ASCII is present,
 * to avoid "RedefiniÃ§Ã£o..." garbling in email clients.
 */
function encodeHeader(value: string): string {
  // If it's pure ASCII, keep as-is.
  if (/^[\x00-\x7F]*$/.test(value)) return value;

  // RFC 2047: =?UTF-8?B?<base64>?=
  const bytes = new TextEncoder().encode(value);
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(bytes).toString("base64")
      : btoa(String.fromCharCode(...bytes));
  return `=?UTF-8?B?${base64}?=`;
}

/**
 * Base64URL encode for Gmail API "raw" field.
 * Works in Convex (web-like) and Node runtimes.
 */
function base64UrlEncode(str: string) {
  const bytes = new TextEncoder().encode(str);

  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(bytes).toString("base64")
      : btoa(String.fromCharCode(...bytes));

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getAccessToken() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Gmail OTP: variáveis ausentes. Defina GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e GMAIL_REFRESH_TOKEN no Convex."
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json().catch(() => ({} as any))) as any;

  if (!res.ok || !json.access_token) {
    throw new Error(
      `Gmail OTP: falha ao obter access_token (${res.status}). ${JSON.stringify(json).slice(0, 300)}`
    );
  }

  return json.access_token as string;
}

export const GmailOTPPasswordReset = {
  id: "gmail-otp-reset",
  type: "email" as const,
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
    const sender = process.env.GMAIL_SENDER_EMAIL;
    if (!sender) {
      throw new Error(
        "Gmail OTP: variável ausente. Defina GMAIL_SENDER_EMAIL no Convex."
      );
    }

    const accessToken = await getAccessToken();

    // Subject contains non-ASCII (ç, ã, —) => must be RFC 2047 encoded.
    const subject = "Redefinição de senha — Make Your Bank";
    const encodedSubject = encodeHeader(subject);

    const text =
      "Recebemos uma solicitação para redefinir sua senha.\n\n" +
      `Código de verificação: ${token}\n\n` +
      "Se você não solicitou, ignore este e-mail.";

    // RFC 5322 raw email. Use CRLF and explicit UTF-8 charset.
    const rawMessage = [
      `From: MKY <${sender}>`,
      `To: <${email}>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      `Subject: ${encodedSubject}`,
      "",
      text,
    ].join("\r\n");

    const raw = base64UrlEncode(rawMessage);

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      }
    );

    if (!sendRes.ok) {
      const errText = await sendRes.text().catch(() => "");
      throw new Error(
        `Gmail OTP: falha ao enviar e-mail (${sendRes.status}). ${errText.slice(0, 400)}`
      );
    }
  },
};
