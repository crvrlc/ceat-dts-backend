const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const createTransporter = async () => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const accessToken = await oauth2Client.getAccessToken();

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.EMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: accessToken.token,
    },
  });
};

const STATUS_LABELS = {
  submitted:     'Submitted',
  received:      'Received',
  processing:    'Processing',
  for_signature: 'For Signature',
  completed:     'Completed',
  released:      'Released',
  rejected:      'Rejected',
};

const getStatusMessage = (status, releaseMethod) => {
  switch (status) {
    case 'received':
      return 'We have received your document at the office. Our staff will begin processing it shortly.';
    case 'processing':
      return 'Your document is currently being processed by our staff.';
    case 'for_signature':
      return 'Your document is awaiting signature approval and will be ready soon.';
    case 'completed':
      return releaseMethod === 'online'
        ? 'Your document has been completed and is available for download. Please log in to the system to download it.'
        : 'Your document is ready for pick up. Please visit the CEAT OCS office at your earliest convenience.';
    case 'released':
      return releaseMethod === 'online'
        ? 'Your document has been released and is ready for download.'
        : 'Your document has been released.';
    case 'rejected':
      return 'Unfortunately, your document request was not approved. Please see the remarks below for details.';
    default:
      return 'There has been an update to your document request.';
  }
};

const sendDocumentUpdateEmail = async ({ studentName, studentEmail, trackingCode, status, releaseMethod, remark }) => {
  const statusMessage = getStatusMessage(status, releaseMethod);
  const statusLabel = STATUS_LABELS[status] || status;

  const statusColors = {
    submitted:     { bg: '#fef6e0', text: '#7a4f00', border: '#f5a800' },
    received:      { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
    processing:    { bg: '#ede9fe', text: '#4c1d95', border: '#8b5cf6' },
    for_signature: { bg: '#f5e6e8', text: '#7b1113', border: '#7b1113' },
    completed:     { bg: '#e6f2e7', text: '#1a5c1e', border: '#236a27' },
    released:      { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
    rejected:      { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  };

  const color = statusColors[status] || { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' };

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f8fafc; padding: 24px;">
      
      <!-- Header -->
      <div style="background: #7b1113; border-radius: 10px 10px 0 0; padding: 24px 28px; text-align: center;">
        <h2 style="color: #fff; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.3px;">
          CEAT Office of the College Secretary
        </h2>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">
          Document Tracking System
        </p>
      </div>

      <!-- Body -->
      <div style="background: #fff; padding: 28px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        
        <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">
          Dear <strong>${studentName}</strong>,
        </p>

        <p style="color: #374151; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">
          This is an update regarding your document request.
        </p>

        <!-- Tracking Info -->
        <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Tracking Code</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #111827; letter-spacing: 0.5px;">${trackingCode}</p>
        </div>

        <!-- Status Badge -->
        <div style="background: ${color.bg}; border: 1px solid ${color.border}; border-left: 4px solid ${color.border}; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: ${color.text}; text-transform: uppercase; letter-spacing: 0.5px;">Current Status</p>
          <p style="margin: 0; font-size: 16px; font-weight: 700; color: ${color.text};">${statusLabel}</p>
        </div>

        <!-- Status Message -->
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
          ${statusMessage}
        </p>

        <!-- Remarks -->
        ${remark ? `
        <div style="background: #fef6e0; border: 1px solid #f5a800; border-left: 4px solid #f5a800; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; color: #7a4f00; text-transform: uppercase; letter-spacing: 0.5px;">Remarks from Staff</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${remark}</p>
        </div>
        ` : ''}

        <!-- CTA Button -->
        <div style="text-align: center; margin: 24px 0;">
          <a href="${process.env.CLIENT_URL}" 
             style="display: inline-block; background: #7b1113; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            View Document Status
          </a>
        </div>

        <p style="color: #374151; font-size: 14px; margin: 0 0 4px;">
          If you have any questions, please contact the CEAT OCS office.
        </p>

        <p style="color: #374151; font-size: 14px; margin: 20px 0 0;">
          Thank you.<br/><br/>
          <strong>CEAT Office of the College Secretary</strong><br/>
          <span style="color: #6b7280; font-size: 13px;">University of the Philippines Los Baños</span>
        </p>

      </div>

      <!-- Footer -->
      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin: 16px 0 0; line-height: 1.6;">
        This is an automated notification from the CEAT Document Tracking System.<br/>
        Please do not reply to this email.
      </p>

    </div>
  `.trim();

  const transporter = await createTransporter();

  await transporter.sendMail({
    from: `"CEAT OCS Document Tracking System" <${process.env.EMAIL_USER}>`,
    to: studentEmail,
    subject: `Document Update [${trackingCode}] - ${statusLabel}`,
    html,
  });
};

module.exports = { sendDocumentUpdateEmail };