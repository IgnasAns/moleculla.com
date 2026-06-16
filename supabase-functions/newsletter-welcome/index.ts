// Supabase Edge Function: newsletter-welcome
// Sends a branded "welcome" email to a new newsletter subscriber via Hostinger SMTP.
// Triggered (fire-and-forget) by the homepage subscribe form after a new signup.
//
// Required function secrets (Edge Functions -> Secrets):
//   SMTP_HOST       = smtp.hostinger.com
//   SMTP_PORT       = 465
//   SMTP_USER       = info@moleculla.com         (the mailbox you authenticate as)
//   SMTP_PASS       = <mailbox password>
//   SMTP_FROM       = noreply@moleculla.com       (or info@moleculla.com)
//   SMTP_FROM_NAME  = Moleculla

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

const LOGO = "https://moleculla.com/assets/mirror/uploads/2025/09/moleculla-logo-email-2.png";

function welcomeHtml() {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2eee7;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;"><tr><td align="center"><table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid rgba(80,74,74,.12);">
  <tr><td align="center" style="background:#504a4a;padding:24px 40px;"><img src="${LOGO}" alt="Moleculla" width="190" style="display:block;width:190px;max-width:62%;height:auto;"></td></tr>
  <tr><td style="padding:30px 40px 0;"><h1 style="margin:0;font-size:22px;font-weight:400;color:#504a4a;">Welcome to the Moleculla circle</h1></td></tr>
  <tr><td style="padding:10px 40px 0;font-size:15px;line-height:1.6;color:#5d5650;"><p style="margin:0 0 22px;">Thanks for joining us. You'll be first to hear about new arrivals, wellness insights, and member-only offers &mdash; straight to your inbox.</p></td></tr>
  <tr><td align="center" style="padding:4px 40px 8px;"><a href="https://moleculla.com/shop/" style="display:inline-block;background:#504a4a;color:#fbfaf3;text-decoration:none;font-size:15px;font-weight:500;padding:14px 38px;border-radius:999px;">Explore the shop</a></td></tr>
  <tr><td style="padding:18px 40px 0;font-size:13px;line-height:1.6;color:#8a827b;"><p style="margin:0 0 18px;">Made to make you feel good.</p></td></tr>
  <tr><td style="padding:24px 40px 34px;border-top:1px solid rgba(80,74,74,.1);"><p style="margin:18px 0 0;font-size:12px;color:#a39a92;text-align:center;">Moleculla &middot; Wellness begins at the molecular level<br><a href="https://moleculla.com" style="color:#9d8775;">moleculla.com</a></p></td></tr>
  </table></td></tr></table>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const { email } = await req.json();
    const to = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ error: "Invalid email." }, 400);

    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com",
        port: Number(Deno.env.get("SMTP_PORT") ?? "465"),
        tls: true,
        auth: {
          username: Deno.env.get("SMTP_USER") ?? "",
          password: Deno.env.get("SMTP_PASS") ?? "",
        },
      },
    });

    const fromAddr = Deno.env.get("SMTP_FROM") ?? Deno.env.get("SMTP_USER") ?? "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Moleculla";

    await client.send({
      from: `${fromName} <${fromAddr}>`,
      to,
      subject: "Welcome to the Moleculla circle",
      content: "Thanks for joining the Moleculla circle. Explore the shop at https://moleculla.com/shop/",
      html: welcomeHtml(),
    });
    await client.close();
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
