import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error("SMTP_USER and SMTP_PASS are not configured in .env");
    }
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

const FROM_NAME = "EduAssess AI";

export async function sendPasswordResetOTPEmail(to: string, otp: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const info = await getTransporter().sendMail({
      from: `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
      to,
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
    console.log(`Successfully sent password reset OTP to ${to}. Message ID: ${info.messageId}`);
    return { success: true };
  } catch (err: any) {
    console.error("Critical error in sendPasswordResetOTPEmail:", err);
    return { success: false, error: err.message };
  }
}

export async function sendUsernameReminderEmail(to: string, username: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const info = await getTransporter().sendMail({
      from: `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
      to,
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
    console.log(`Successfully sent username reminder to ${to}. Message ID: ${info.messageId}`);
    return { success: true };
  } catch (err: any) {
    console.error("Error sending username reminder email:", err);
    return { success: false, error: err.message };
  }
}

export async function sendOTPVerificationEmail(to: string, otp: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const info = await getTransporter().sendMail({
      from: `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
      to,
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
    console.log(`Successfully sent verification OTP to ${to}. Message ID: ${info.messageId}`);
    return { success: true };
  } catch (err: any) {
    console.error("Critical error in sendOTPVerificationEmail:", err);
    return { success: false, error: err.message };
  }
}
