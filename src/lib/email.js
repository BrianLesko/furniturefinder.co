// Mail through Resend's API. The sign-in email follows textwork.co's.

const FROM = process.env.RESEND_FROM_EMAIL || "Furniture Finder <noreply@furniturefinder.co>";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function send({ to, subject, html, text }) {
  if (!process.env.RESEND_KEY) throw new Error("RESEND_KEY is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend ${response.status}: ${body.message ?? "send failed"}`);
  return body;
}

export function sendLoginEmail(email, link, code) {
  const safeLink = escapeHtml(link);
  const spaced = escapeHtml(code.split("").join(" "));
  const year = new Date().getFullYear();
  const preheader = `Your sign-in code is ${code}. It expires in 15 minutes.`;

  return send({
    to: email,
    subject: "Sign in to Furniture Finder",
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="light">
          <meta name="supported-color-schemes" content="light">
          <title>Sign in to Furniture Finder</title>
        </head>
        <body style="margin: 0; padding: 0; background: #f4f4f5; color: #111111; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">
            ${escapeHtml(preheader)}
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f5; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: #ffffff; border-radius: 16px; overflow: hidden;">
                  <tr>
                    <td style="padding: 36px 32px 12px 32px;">
                      <p style="margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.02em; color: #111111;">Furniture Finder</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 32px 36px 32px;">
                      <h1 style="margin: 0 0 12px 0; font-size: 24px; line-height: 1.25; font-weight: 500; letter-spacing: -0.03em; color: #111111;">
                        Sign in
                      </h1>
                      <p style="margin: 0 0 28px 0; color: #52525b; font-size: 15px; line-height: 1.55;">
                        Use the button below to open your studio. This link expires in 15 minutes.
                      </p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 0 0 28px 0;">
                            <a href="${safeLink}"
                               style="display: inline-block; background: #111111; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 10px; font-size: 15px; font-weight: 500;">
                              Sign in to Furniture Finder
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
                        Or enter this code on the sign-in page
                      </p>
                      <div style="background: #f4f4f5; border-radius: 12px; padding: 18px 16px; text-align: center; margin: 0 0 28px 0;">
                        <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; letter-spacing: 0.28em; color: #111111; font-weight: 600; line-height: 1.2;">
                          ${spaced}
                        </div>
                      </div>
                      <p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 12px;">
                        Or paste this link into your browser
                      </p>
                      <p style="margin: 0 0 28px 0; color: #71717a; font-size: 12px; line-height: 1.5; word-break: break-all;">
                        ${safeLink}
                      </p>
                      <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.5;">
                        If you didn&apos;t request this, you can ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="margin: 20px 0 0 0; color: #a1a1aa; font-size: 12px;">
                  &copy; ${year} Furniture Finder
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: [
      "Sign in to Furniture Finder",
      "",
      "Open this link to sign in. It expires in 15 minutes:",
      link,
      "",
      `Or enter this code on the sign-in page: ${code}`,
      "",
      "If you didn't request this, you can ignore this email.",
    ].join("\n"),
  });
}
