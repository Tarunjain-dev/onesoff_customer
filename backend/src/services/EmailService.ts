type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const isEmailEnabled = () => String(process.env.EMAIL_ENABLED || '').toLowerCase() === 'true';

export const EmailService = {
  async sendEmail(params: SendEmailParams) {
    if (!isEmailEnabled()) {
      return { success: true, skipped: true as const };
    }

    // Future: AWS SES / SMTP (Nodemailer)
    // Keeping this implemented behind a feature flag as requested.
    console.warn('Email is enabled but no provider is configured yet.', {
      to: params.to,
      subject: params.subject
    });

    return {
      success: false,
      error: 'Email provider is not configured (set EMAIL_ENABLED=false or configure SES/SMTP).'
    };
  }
};

