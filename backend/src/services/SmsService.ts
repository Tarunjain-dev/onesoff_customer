import axios from 'axios';
import twilio from 'twilio';
import logger from '../utils/logger';

type SmsProviderMode = 'MSG91' | 'TWILIO' | 'MSG91_THEN_TWILIO';
const TWILIO_VERIFY_PREFIX = 'TWILIO_VERIFY:';

const parseCsvEnv = (value?: string) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  try {
    return twilio(accountSid, authToken);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Twilio client initialization failed'
    );
    return null;
  }
};

const getTwilioFromNumber = () => process.env.TWILIO_PHONE_NUMBER || '';
const getTwilioMessagingServiceSid = () =>
  process.env.TWILIO_MESSAGING_SERVICE_SID || '';
const getTwilioVerifyServiceSid = () =>
  process.env.TWILIO_VERIFY_SERVICE_SID || '';

const maskPhone = (phone?: string | null) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return 'unknown';
  return `***${digits.slice(-4)}`;
};

const normalizeIndianMobile = (raw: string) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return { national: '', e164: '' };
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  const e164 = last10.length === 10 ? `+91${last10}` : raw;
  return { national: last10, e164 };
};

const normalizePhoneKey = (phone?: string | null) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

const getTestOtpForPhone = (phone: string) => {
  const enabled = String(process.env.TEST_OTP_ENABLED || '').toLowerCase() === 'true';
  const configuredOtp = String(process.env.TEST_OTP_CODE || '').trim();
  if (!enabled || !configuredOtp) return null;

  const allowedPhones = new Set(
    parseCsvEnv(process.env.TEST_OTP_ALLOWED_PHONES).map((entry) =>
      normalizePhoneKey(entry)
    )
  );
  const normalizedPhone = normalizePhoneKey(phone);

  if (normalizedPhone && allowedPhones.has(normalizedPhone)) {
    return configuredOtp;
  }

  return null;
};

const canUseMsg91 = () =>
  Boolean(
    (process.env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_TOKEN) &&
      (process.env.MSG91_FLOW_ID || process.env.MSG91_SENDER_ID)
  );

const canUseTwilioVerify = () =>
  Boolean(getTwilioClient() && getTwilioVerifyServiceSid());

const sendViaMsg91Flow = async (phone: string, message: string) => {
  const authKey = process.env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_TOKEN;
  const flowId = process.env.MSG91_FLOW_ID;
  if (!authKey || !flowId) {
    throw new Error(
      'MSG91 is not configured (missing MSG91_AUTH_KEY/MSG91_AUTH_TOKEN or MSG91_FLOW_ID)'
    );
  }

  const { national } = normalizeIndianMobile(phone);
  if (!national) throw new Error('Invalid phone number');

  const baseUrl = process.env.MSG91_BASE_URL || 'https://api.msg91.com/api/v5/flow/';
  const sender = process.env.MSG91_SENDER_ID;

  // Configure your Flow to accept a "message" variable.
  const payload: any = {
    flow_id: flowId,
    mobiles: `91${national}`,
    VAR1: message
  };
  if (sender) payload.sender = sender;

  const response = await axios.post(baseUrl, payload, {
    headers: { authkey: authKey, 'Content-Type': 'application/json' },
    timeout: 15000
  });

  return { provider: 'MSG91', response: response.data };
};

const sendViaTwilio = async (phone: string, message: string) => {
  const client = getTwilioClient();
  const from = getTwilioFromNumber();
  const messagingServiceSid = getTwilioMessagingServiceSid();
  if (!client || (!from && !messagingServiceSid)) {
    throw new Error(
      'Twilio is not configured (missing TWILIO credentials and sender or messaging service sid)'
    );
  }

  const { e164 } = normalizeIndianMobile(phone);
  const to = e164 || phone;
  const sms = await client.messages.create(
    messagingServiceSid
      ? { body: message, messagingServiceSid, to }
      : { body: message, from, to }
  );
  return { provider: 'TWILIO', response: { sid: sms.sid, status: sms.status } };
};

const sendViaTwilioVerify = async (phone: string) => {
  const client = getTwilioClient();
  const verifyServiceSid = getTwilioVerifyServiceSid();
  if (!client || !verifyServiceSid) {
    throw new Error(
      'Twilio Verify is not configured (missing TWILIO credentials or TWILIO_VERIFY_SERVICE_SID)'
    );
  }

  const { e164 } = normalizeIndianMobile(phone);
  const to = e164 || phone;
  const verification = await client.verify.v2
    .services(verifyServiceSid)
    .verifications.create({
      to,
      channel: 'sms'
    });

  return {
    provider: 'TWILIO_VERIFY',
    response: { sid: verification.sid, status: verification.status },
    marker: `${TWILIO_VERIFY_PREFIX}${verification.sid}`
  };
};

const verifyViaTwilioVerify = async (
  phone: string,
  code: string,
  verificationSid?: string
) => {
  const client = getTwilioClient();
  const verifyServiceSid = getTwilioVerifyServiceSid();
  if (!client || !verifyServiceSid) {
    throw new Error(
      'Twilio Verify is not configured (missing TWILIO credentials or TWILIO_VERIFY_SERVICE_SID)'
    );
  }

  const { e164 } = normalizeIndianMobile(phone);
  const to = e164 || phone;
  const sid = String(verificationSid || '')
    .replace(TWILIO_VERIFY_PREFIX, '')
    .trim();

  const verificationCheck = await client.verify.v2
    .services(verifyServiceSid)
    .verificationChecks.create(
      sid
        ? {
            code,
            verificationSid: sid
          }
        : {
            code,
            to
          }
    );

  return verificationCheck.status === 'approved' && verificationCheck.valid === true;
};

const buildOtpMessage = (otp: string) =>
  `Your OnesOff verification code is ${otp}. Valid for 10 minutes.`;

export const SmsService = {
  async sendOtp(phone: string, otp: string): Promise<boolean> {
    const message = buildOtpMessage(otp);
    const ok = await SmsService.sendSms(phone, message, {
      forceProvider: 'MSG91_THEN_TWILIO'
    });
    return ok;
  },

  async sendOtpViaMC(phone: string): Promise<string> {
    const testOtp = getTestOtpForPhone(phone);
    if (testOtp) {
      logger.info({ phone: maskPhone(phone) }, 'Using configured test OTP path');
      return testOtp;
    }

    if (canUseTwilioVerify()) {
      const verification = await sendViaTwilioVerify(phone);
      logger.info(
        { phone: maskPhone(phone), provider: verification.provider },
        'Twilio Verify OTP started'
      );
      return verification.marker;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const ok = await SmsService.sendSms(phone, buildOtpMessage(otp), {
      forceProvider: 'MSG91_THEN_TWILIO'
    });

    if (!ok) {
      throw new Error(
        'Failed to send OTP via SMS provider. Please check Twilio/MSG91 configuration.'
      );
    }

    return otp;
  },

  async verifyOtp(_phone: string, code: string, verificationId: string): Promise<boolean> {
    if (String(verificationId || '').startsWith(TWILIO_VERIFY_PREFIX)) {
      return verifyViaTwilioVerify(_phone, code, verificationId);
    }

    return code === verificationId;
  },

  async sendSms(
    phone: string,
    message: string,
    options?: { forceProvider?: SmsProviderMode }
  ): Promise<boolean> {
    try {
      const mode = options?.forceProvider || 'MSG91_THEN_TWILIO';

      if (mode === 'TWILIO') {
        await sendViaTwilio(phone, message);
        return true;
      }

      if (mode === 'MSG91') {
        await sendViaMsg91Flow(phone, message);
        return true;
      }

      if (canUseMsg91()) {
        try {
          await sendViaMsg91Flow(phone, message);
          return true;
        } catch (error) {
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              phone: maskPhone(phone)
            },
            'MSG91 failed, falling back to Twilio'
          );
        }
      }

      await sendViaTwilio(phone, message);
      return true;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          phone: maskPhone(phone)
        },
        'SMS sending failed'
      );
      return false;
    }
  }
};
