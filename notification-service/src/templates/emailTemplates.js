/**
 * Generates a modern, responsive IRCTC NextGen branded HTML email template for OTP verification
 * @param {object} params
 * @param {string} params.otp - 6 digit OTP
 * @param {string} [params.firstName="Passenger"] - recipient name
 * @param {number} [params.validityMinutes=5] - OTP TTL in minutes
 * @returns {string} HTML string
 */
export function renderOtpEmailHtml({ otp, firstName = "Passenger", validityMinutes = 5 }) {
    const formattedFirstName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "Passenger";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IRCTC Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f0f4f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f0f4f8;
      padding: 30px 0;
    }
    .main-table {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0f2b46 0%, #173d63 100%);
      padding: 32px 30px;
      text-align: center;
      border-bottom: 4px solid #f97316;
    }
    .brand-title {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 1px;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-subtitle {
      color: #cbd5e1;
      font-size: 12px;
      letter-spacing: 0.5px;
      margin: 6px 0 0 0;
    }
    .content {
      padding: 36px 32px 24px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #0f2b46;
      margin: 0 0 14px 0;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 24px 0;
    }
    .otp-container {
      background: #f8fafc;
      border: 2px dashed #cbd5e1;
      border-radius: 10px;
      padding: 24px 20px;
      text-align: center;
      margin: 28px 0;
    }
    .otp-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .otp-code {
      font-family: 'SF Pro Display', Consolas, Monaco, 'Courier New', monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #0f2b46;
      margin: 0;
      padding-left: 10px;
    }
    .expiry-badge {
      display: inline-block;
      margin-top: 12px;
      background-color: #fee2e2;
      color: #991b1b;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 9999px;
    }
    .warning-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 14px 16px;
      border-radius: 6px;
      margin: 24px 0 16px 0;
    }
    .warning-text {
      font-size: 13px;
      line-height: 1.5;
      color: #92400e;
      margin: 0;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 30px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
    .footer-text {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
      margin: 0 0 8px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main-table" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="header">
          <h1 class="brand-title">IRCTC NextGen</h1>
          <p class="brand-subtitle">Indian Railway Catering and Tourism Corporation Ltd.</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          <p class="greeting">Namaste, ${formattedFirstName}!</p>
          <p class="message">
            Thank you for initiating registration on the IRCTC NextGen e-Ticketing portal.
            To complete your verification and secure your account, please enter the One-Time Password (OTP) provided below:
          </p>

          <div class="otp-container">
            <div class="otp-label">Your Verification Code</div>
            <div class="otp-code">${otp}</div>
            <div class="expiry-badge">&#x23F1; Valid for ${validityMinutes} minutes</div>
          </div>

          <div class="warning-box">
            <p class="warning-text">
              <strong>Security Alert:</strong> Never share this OTP with anyone, including IRCTC officials or railway personnel. IRCTC will never ask for your password or OTP over phone, SMS, or email.
            </p>
          </div>

          <p class="message" style="margin-bottom: 0; font-size: 13px; color: #64748b;">
            If you did not initiate this request, please safely disregard this email or contact support if you suspect unauthorized activity.
          </p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p class="footer-text">
            This is an automated system notification from IRCTC e-Ticketing Service. Please do not reply directly to this email.
          </p>
          <p class="footer-text" style="margin: 0;">
            &copy; ${new Date().getFullYear()} IRCTC Ltd. (A Government of India Enterprise). All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Generates an IRCTC NextGen branded HTML email template for Account Welcome
 * @param {object} params
 * @param {string} [params.firstName="Passenger"] - recipient name
 * @param {string} [params.lastName=""] - recipient last name
 * @returns {string} HTML string
 */
export function renderWelcomeEmailHtml({ firstName = "Passenger", lastName = "" }) {
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Passenger";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to IRCTC NextGen</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f0f4f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f0f4f8;
      padding: 30px 0;
    }
    .main-table {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0f2b46 0%, #173d63 100%);
      padding: 32px 30px;
      text-align: center;
      border-bottom: 4px solid #10b981;
    }
    .brand-title {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 1px;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-subtitle {
      color: #cbd5e1;
      font-size: 12px;
      letter-spacing: 0.5px;
      margin: 6px 0 0 0;
    }
    .content {
      padding: 36px 32px 24px 32px;
    }
    .greeting {
      font-size: 20px;
      font-weight: 700;
      color: #0f2b46;
      margin: 0 0 16px 0;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 20px 0;
    }
    .features-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .features-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f2b46;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .feature-item {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      font-size: 14px;
      color: #334155;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 30px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
    .footer-text {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
      margin: 0 0 8px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main-table" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="header">
          <h1 class="brand-title">IRCTC NextGen</h1>
          <p class="brand-subtitle">Indian Railway Catering and Tourism Corporation Ltd.</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          <p class="greeting">Welcome aboard, ${fullName}! &#x1F686;</p>
          <p class="message">
            Your IRCTC NextGen account has been successfully created and verified. You now have full access to high-speed railway ticket booking, PNR tracking, Tatkal reservations, and meal booking.
          </p>

          <div class="features-card">
            <div class="features-title">What you can do next</div>
            <div class="feature-item">&#x2714;&#xFE0F; Search and book train tickets seamlessly</div>
            <div class="feature-item">&#x2714;&#xFE0F; Check live train running status & PNR confirmation</div>
            <div class="feature-item">&#x2714;&#xFE0F; Manage passenger master list for 1-click Tatkal bookings</div>
          </div>

          <p class="message" style="margin-bottom: 0; font-size: 13px; color: #64748b;">
            Wishing you pleasant and safe journeys with Indian Railways!
          </p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p class="footer-text">
            This is an automated system confirmation from IRCTC e-Ticketing Service. Please do not reply directly to this email.
          </p>
          <p class="footer-text" style="margin: 0;">
            &copy; ${new Date().getFullYear()} IRCTC Ltd. (A Government of India Enterprise). All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}
