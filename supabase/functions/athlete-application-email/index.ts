import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });


function describeError(error: unknown) {
  if (error instanceof Error) {
    const anyError = error as Error & {
      code?: unknown;
      response?: unknown;
      responseCode?: unknown;
      command?: unknown;
      errno?: unknown;
      syscall?: unknown;
      hostname?: unknown;
    };

    const extras = [
      anyError.code ? `code=${String(anyError.code)}` : "",
      anyError.responseCode ? `responseCode=${String(anyError.responseCode)}` : "",
      anyError.response ? `response=${String(anyError.response)}` : "",
      anyError.command ? `command=${String(anyError.command)}` : "",
      anyError.errno ? `errno=${String(anyError.errno)}` : "",
      anyError.syscall ? `syscall=${String(anyError.syscall)}` : "",
      anyError.hostname ? `hostname=${String(anyError.hostname)}` : "",
    ].filter(Boolean);

    return extras.length ? `${error.message} (${extras.join(", ")})` : error.message;
  }

  if (error && typeof error === "object") {
    try {
      const record = error as Record<string, unknown>;
      const message =
        String(record.message || record.error || record.response || "").trim() ||
        JSON.stringify(record);
      return message || "Unknown email error object.";
    } catch {
      return "Unknown email error object.";
    }
  }

  return String(error || "Unknown email error.");
}

function displayName(profile: Record<string, unknown> | null) {
  if (!profile) return "Athlete";
  const parts = [profile.first_name, profile.middle_name, profile.last_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.join(" ") || String(profile.full_name || "Athlete");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const gmailUser = (Deno.env.get("GMAIL_USER") || "").trim();
    const gmailAppPassword = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
    const appUrl = (Deno.env.get("APP_URL") || "").trim();

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables.");
    }
    if (!gmailUser || !gmailAppPassword) {
      return json({ success: false, error: "GMAIL_USER or GMAIL_APP_PASSWORD is missing." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Missing authorization token." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    const caller = authData.user;
    if (authError || !caller) {
      return json({ success: false, error: "Invalid or expired session." }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const event = String(payload.event || "").trim().toLowerCase();
    const affiliateId = String(payload.affiliate_id || "").trim();

    if (!affiliateId || !["submitted", "approved"].includes(event)) {
      return json({ success: false, error: "Invalid notification request." }, 400);
    }

    const { data: affiliate, error: affiliateError } = await adminClient
      .from("affiliates")
      .select("id,user_id,affiliate_code,status,approved_at")
      .eq("id", affiliateId)
      .maybeSingle();

    if (affiliateError) throw affiliateError;
    if (!affiliate) return json({ success: false, error: "Athlete application not found." }, 404);

    const { data: athleteProfile, error: athleteProfileError } = await adminClient
      .from("profiles")
      .select("id,role,full_name,first_name,middle_name,last_name,email,mobile_number,address")
      .eq("id", affiliate.user_id)
      .maybeSingle();

    if (athleteProfileError) throw athleteProfileError;
    if (!athleteProfile?.email) return json({ success: false, error: "Athlete email not found." }, 404);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailAppPassword },
    });

    if (event === "submitted") {
      if (caller.id !== affiliate.user_id) {
        return json({ success: false, error: "You can only submit your own athlete application." }, 403);
      }

      const { data: admins, error: adminsError } = await adminClient
        .from("profiles")
        .select("email")
        .eq("role", "admin")
        .not("email", "is", null);

      if (adminsError) throw adminsError;
      const recipients = [...new Set((admins || []).map((row) => row.email).filter(Boolean))];
      if (!recipients.length) {
        return json({ success: true, email_sent: false, message: "No admin email address is configured." });
      }

      const name = displayName(athleteProfile);
      const mailInfo = await transporter.sendMail({
        from: `"PEAKATHLETE" <${gmailUser}>`,
        to: recipients.join(","),
        subject: `New athlete application: ${name}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:620px;margin:auto">
            <h2>New athlete application awaiting approval</h2>
            <p><strong>${name}</strong> submitted an athlete application.</p>
            <p><strong>Email:</strong> ${athleteProfile.email}<br/>
               <strong>Athlete code:</strong> ${affiliate.affiliate_code}</p>
            <p>Sign in to the PEAKATHLETE Admin Portal, open <strong>Applications</strong>, review the submitted profile and payout information, then approve the account.</p>
            ${appUrl ? `<p><a href="${appUrl}">Open PEAKATHLETE</a></p>` : ""}
          </div>
        `,
      });

      console.log("Athlete application notification sent", {
        event,
        affiliate_id: affiliateId,
        recipients,
        message_id: mailInfo.messageId,
      });
      return json({ success: true, email_sent: true, message_id: mailInfo.messageId });
    }

    // Approval event: only an admin may approve or resend an approval email.
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("role,email")
      .eq("id", caller.id)
      .maybeSingle();

    if (callerProfileError) throw callerProfileError;
    if (callerProfile?.role !== "admin") {
      return json({ success: false, error: "Admin access required." }, 403);
    }

    if (!["pending", "approved"].includes(String(affiliate.status))) {
      return json({ success: false, error: `Cannot approve athlete while status is ${affiliate.status}.` }, 400);
    }

    const wasAlreadyApproved = affiliate.status === "approved";
    const previousApprovedAt = affiliate.approved_at || null;
    const approvedAt = new Date().toISOString();

    // Test the Gmail SMTP connection before changing application status.
    // This surfaces bad/missing App Passwords and connection errors clearly.
    try {
      await transporter.verify();
      console.log("Gmail SMTP verification succeeded", {
        gmail_user: gmailUser,
        affiliate_id: affiliateId,
      });
    } catch (smtpVerifyError) {
      const details = describeError(smtpVerifyError);
      console.error("Gmail SMTP verification failed:", details);
      return json(
        {
          success: false,
          email_sent: false,
          error: `Gmail SMTP verification failed: ${details}`,
        },
        500,
      );
    }

    // If this is a new approval, mark it approved first. If SMTP fails below, roll it back.
    if (!wasAlreadyApproved) {
      const { error: approveError } = await adminClient
        .from("affiliates")
        .update({ status: "approved", approved_at: approvedAt })
        .eq("id", affiliateId)
        .eq("status", "pending");
      if (approveError) throw approveError;

      const { error: payoutVerifyError } = await adminClient
        .from("payout_accounts")
        .update({ verified_at: approvedAt })
        .eq("affiliate_id", affiliateId);
      if (payoutVerifyError) {
        await adminClient
          .from("affiliates")
          .update({ status: "pending", approved_at: previousApprovedAt })
          .eq("id", affiliateId);
        throw payoutVerifyError;
      }
    }

    const name = displayName(athleteProfile);

    try {
      const mailInfo = await transporter.sendMail({
        from: `"PEAKATHLETE" <${gmailUser}>`,
        to: athleteProfile.email,
        subject: "Your PEAKATHLETE athlete application has been approved",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:620px;margin:auto">
            <h2>Your athlete application is approved</h2>
            <p>Hi ${name},</p>
            <p>Your PEAKATHLETE athlete application has been reviewed and <strong>approved</strong>.</p>
            <p>You can now sign in and access your athlete dashboard, sales, commissions, and profile.</p>
            ${appUrl ? `<p><a href="${appUrl}">Sign in to PEAKATHLETE</a></p>` : ""}
            <p>Welcome to PEAKATHLETE.</p>
          </div>
        `,
      });

      console.log("Athlete approval email sent", {
        event,
        affiliate_id: affiliateId,
        recipient: athleteProfile.email,
        approved_by: callerProfile.email || caller.id,
        message_id: mailInfo.messageId,
      });

      return json({
        success: true,
        email_sent: true,
        approved: true,
        message_id: mailInfo.messageId,
      });
    } catch (mailError) {
      // New approvals are rolled back when notification delivery fails.
      if (!wasAlreadyApproved) {
        await adminClient
          .from("affiliates")
          .update({ status: "pending", approved_at: previousApprovedAt })
          .eq("id", affiliateId);
        await adminClient
          .from("payout_accounts")
          .update({ verified_at: null })
          .eq("affiliate_id", affiliateId);
      }
      throw mailError;
    }
  } catch (error) {
    const details = describeError(error);
    console.error("Athlete application email error:", details, error);
    return json(
      {
        success: false,
        email_sent: false,
        error: details || "Failed to send notification email.",
      },
      500,
    );
  }
});
