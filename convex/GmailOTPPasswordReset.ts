import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { api } from "./_generated/api";
import { ConvexHttpClient } from "convex/browser";

/**
 * Provider de reset de senha via Gmail (Convex Auth / Password).
 *
 * IMPORTANTÍSSIMO:
 * - Não importamos "googleapis" aqui (isso quebra no bundler).
 * - O envio real é feito por uma Action Node em convex/gmailSend.ts ("use node").
 */
export const GmailOTPPasswordReset = {
  id: "gmail-otp-reset",
  type: "email",
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
    provider?: unknown; // o Auth pode passar, mas não precisamos aqui
  }) {
    const deploymentUrl =
      process.env.CONVEX_URL ||
      process.env.CONVEX_DEPLOYMENT_URL ||
      process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!deploymentUrl) {
      throw new Error(
        "Gmail OTP: CONVEX_URL (ou CONVEX_DEPLOYMENT_URL / NEXT_PUBLIC_CONVEX_URL) não definida. Necessário para chamar a action gmailSend."
      );
    }

    const client = new ConvexHttpClient(deploymentUrl);

    // Chama Action Node responsável por enviar via Gmail API
    await client.action(api.gmailSend.sendResetCodeEmail, {
      to: email,
      code: token,
    });
  },
};
