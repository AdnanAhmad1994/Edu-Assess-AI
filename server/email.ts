import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured. Please add it in Settings.");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "EduAssess AI <onboarding@resend.dev>";

export async function sendPasswordResetOTPEmail(to: string, otp: string, name: string) {
  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: "Reset Your Password - EduAssess AI",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; margin: 0;">EduAssess AI</h1>
            <p style="color: #666; margin: 5px 0 0;">Password Reset Request</p>
          </div>
          <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <p style="color: #333; font-size: 16px; margin: 0 0 15px;">Hi ${name},</p>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              We received a request to reset your password. Please use the 6-digit code below to set a new password. 
              This code will expire in 15 minutes.
            </p>
            <div style="text-align: center; margin: 25px 0;">
              <div style="background: white; border: 2px solid #4f46e5; border-radius: 8px; padding: 15px 30px; display: inline-block; letter-spacing: 5px;">
                <span style="font-size: 24px; font-weight: bold; color: #4f46e5;">${otp}</span>
              </div>
            </div>
            <p style="color: #888; font-size: 12px; line-height: 1.5;">
              If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send password reset email. Resend Error:", JSON.stringify(error, null, 2));
      return false;
    }
    console.log(`Successfully sent password reset OTP to ${to}. Email ID: ${data?.id}`);
    return true;
  } catch (err) {
    console.error("Critical error in sendPasswordResetOTPEmail:", err);
    return false;
  }
}

export async function sendUsernameReminderEmail(to: string, username: string, name: string) {
  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: "Your Username - EduAssess AI",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; margin: 0;">EduAssess AI</h1>
            <p style="color: #666; margin: 5px 0 0;">Username Reminder</p>
          </div>
          <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <p style="color: #333; font-size: 16px; margin: 0 0 15px;">Hi ${name},</p>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              You requested a reminder of your username. Here it is:
            </p>
            <div style="text-align: center; margin: 25px 0;">
              <div style="background: white; border: 2px solid #4f46e5; border-radius: 8px; padding: 15px 30px; display: inline-block;">
                <span style="font-size: 20px; font-weight: bold; color: #4f46e5;">${username}</span>
              </div>
            </div>
            <p style="color: #888; font-size: 12px; line-height: 1.5;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send username reminder email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error sending username reminder email:", err);
    return false;
  }
}

export async function sendOTPVerificationEmail(to: string, otp: string, name: string) {
  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: "Verify your email - EduAssess AI",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; margin: 0;">EduAssess AI</h1>
            <p style="color: #666; margin: 5px 0 0;">Email Verification</p>
          </div>
          <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <p style="color: #333; font-size: 16px; margin: 0 0 15px;">Hi ${name},</p>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              Please use the following 6-digit code to verify your email address and activate your account.
              This code will expire in 10 minutes.
            </p>
            <div style="text-align: center; margin: 25px 0;">
              <div style="background: white; border: 2px solid #4f46e5; border-radius: 8px; padding: 15px 30px; display: inline-block; letter-spacing: 5px;">
                <span style="font-size: 24px; font-weight: bold; color: #4f46e5;">${otp}</span>
              </div>
            </div>
            <p style="color: #888; font-size: 12px; line-height: 1.5;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send verification email. Resend Error:", JSON.stringify(error, null, 2));
      return false;
    }
    console.log(`Successfully sent verification OTP to ${to}. Email ID: ${data?.id}`);
    return true;
  } catch (err) {
    console.error("Critical error in sendOTPVerificationEmail:", err);
    return false;
  }
}
