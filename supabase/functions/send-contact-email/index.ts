import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FeedbackPayload {
  type: "feedback";
  feedbackType: string;
  goal: string;
  issue: string;
  page: string;
  userEmail?: string;
  playerName?: string;
  valueWrong?: boolean;
  leagueId?: string;
  url?: string;
  timestamp?: string;
}

type RequestPayload = ContactFormData | FeedbackPayload;

function isFeedback(payload: RequestPayload): payload is FeedbackPayload {
  return (payload as FeedbackPayload).type === "feedback";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: RequestPayload = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error: "Email service not configured. Please contact support directly at fantasydraftproshelp@gmail.com"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let emailSubject: string;
    let emailBody: string;
    let replyTo: string | undefined;

    if (isFeedback(payload)) {
      const typeLabel: Record<string, string> = {
        bug: "Bug Report",
        wrong_value: "Wrong Value",
        confusing: "Confusing UI",
        feature: "Feature Request",
        other: "Other",
      };

      emailSubject = `[Feedback] ${typeLabel[payload.feedbackType] ?? payload.feedbackType}`;
      replyTo = payload.userEmail;

      emailBody = `
        <h2>User Feedback Submission</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;font-weight:bold;width:160px">Type</td><td style="padding:8px">${typeLabel[payload.feedbackType] ?? payload.feedbackType}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">User</td><td style="padding:8px">${payload.userEmail ?? "Anonymous"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Page</td><td style="padding:8px">${payload.page ?? "Unknown"}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">URL</td><td style="padding:8px">${payload.url ?? "-"}</td></tr>
          ${payload.playerName ? `<tr><td style="padding:8px;font-weight:bold">Player</td><td style="padding:8px">${payload.playerName}${payload.valueWrong ? " (value flagged as wrong)" : ""}</td></tr>` : ""}
          ${payload.leagueId ? `<tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">League ID</td><td style="padding:8px">${payload.leagueId}</td></tr>` : ""}
          <tr><td style="padding:8px;font-weight:bold">Submitted</td><td style="padding:8px">${payload.timestamp ?? new Date().toISOString()}</td></tr>
        </table>
        <hr style="margin:16px 0">
        <h3>What were you trying to do?</h3>
        <p style="background:#f5f5f5;padding:12px;border-radius:6px">${payload.goal || "(not provided)"}</p>
        <h3>What went wrong / request details</h3>
        <p style="background:#f5f5f5;padding:12px;border-radius:6px">${(payload.issue ?? "").replace(/\n/g, "<br>") || "(not provided)"}</p>
      `;
    } else {
      const { name, email, subject, message } = payload as ContactFormData;

      if (!name || !email || !subject || !message) {
        return new Response(
          JSON.stringify({ error: "All fields are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      emailSubject = `Contact Form: ${subject}`;
      replyTo = email;

      emailBody = `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
        <hr>
        <p><em>Reply directly to this email to respond to ${name} at ${email}</em></p>
      `;
    }

    const emailPayload: Record<string, unknown> = {
      from: "Fantasy Draft Pros <noreply@cmgfi.com>",
      to: ["fantasydraftproshelp@gmail.com"],
      subject: emailSubject,
      html: emailBody,
    };

    if (replyTo) {
      emailPayload.reply_to = replyTo;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      throw new Error("Failed to send email");
    }

    const data = await response.json();
    console.log("Email sent successfully:", data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send email. Please try again or contact us directly at fantasydraftproshelp@gmail.com"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
