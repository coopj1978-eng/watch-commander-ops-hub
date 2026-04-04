import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { Resend } from "resend";
import crypto from "crypto";
import db from "../db";

const resendApiKeyRef = secret("ResendApiKey");
const frontendUrlRef = secret("FrontendUrl");

interface ForgotPasswordRequest {
  email: string;
}

interface ForgotPasswordResponse {
  success: boolean;
  // Always returns success even if email not found — prevents email enumeration
}

export const forgotPassword = api<ForgotPasswordRequest, ForgotPasswordResponse>(
  { expose: true, method: "POST", path: "/auth/forgot-password" },
  async (req) => {
    const email = req.email.trim().toLowerCase();

    const user = await db.queryRow<{ id: string; name: string; email: string }>`
      SELECT id, name, email FROM users WHERE LOWER(email) = ${email} AND left_at IS NULL
    `;

    // Always return success — don't reveal whether email exists
    if (!user) return { success: true };

    // Generate a secure random token (32 bytes = 64 hex chars)
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await db.exec`
      UPDATE users
      SET password_reset_token = ${token},
          password_reset_expires = ${expires},
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // Build reset link
    let frontendUrl = "http://localhost:5173";
    try {
      const val = frontendUrlRef();
      if (val) frontendUrl = val;
    } catch {
      // Not configured — use local dev default
    }
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    // Send email via Resend
    let resendKey = "";
    try {
      resendKey = resendApiKeyRef();
    } catch {
      // Not configured
    }

    if (!resendKey) {
      // Dev mode: log the link instead of sending email
      console.log(`\n[DEV] Password reset link for ${user.email}:\n${resetLink}\n`);
      return { success: true };
    }

    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({
      from: "Watch Commander Ops Hub <onboarding@resend.dev>",
      to: [user.email],
      subject: "Reset your password — Watch Commander Ops Hub",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Watch Commander Ops Hub</h1>
          </div>
          <p style="font-size: 16px; color: #111;">Hi ${user.name},</p>
          <p style="color: #444;">We received a request to reset your password. Click the button below to set a new one. This link expires in <strong>1 hour</strong>.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}"
               style="background: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
              Reset my password
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
          <p style="color: #bbb; font-size: 12px; border-top: 1px solid #eee; padding-top: 16px; margin-top: 24px;">
            Watch Commander Ops Hub · Sent to ${user.email}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[Resend] Failed to send password reset email:", error);
    } else {
      console.log("[Resend] Password reset email sent, id:", data?.id);
    }

    return { success: true };
  }
);
