import { Request, Response, NextFunction } from "express";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 3;
const otpRequestStore = new Map<string, { count: number; resetAt: number }>();

const normalizePhoneKey = (phone: unknown) =>
  String(phone || '')
    .replace(/\D/g, '')
    .slice(-10);

const buildRateLimitKey = (req: Request) => {
  const phoneKey = normalizePhoneKey(req.body?.phone || req.body?.emailOrPhone);
  const ipKey = String(req.ip || req.headers['x-forwarded-for'] || 'unknown').trim();
  return `otp_limit:${phoneKey || 'unknown'}:${ipKey}`;
};

const getRateLimitState = (key: string) => {
  const now = Date.now();
  const existing = otpRequestStore.get(key);

  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + WINDOW_MS };
    otpRequestStore.set(key, fresh);
    return fresh;
  }

  return existing;
};

const cleanupExpiredOtpLimits = () => {
  const now = Date.now();
  for (const [key, state] of otpRequestStore.entries()) {
    if (state.resetAt <= now) {
      otpRequestStore.delete(key);
    }
  }
};

export const otpRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    cleanupExpiredOtpLimits();
    const key = buildRateLimitKey(req);
    const state = getRateLimitState(key);
    state.count += 1;

    if (state.count > MAX_REQUESTS) {
      return res.status(429).json({
        success: false,
        error: "Too many OTP requests. Try again after 5 minutes."
      });
    }
    
    next();
  } catch (error) {
    next();
  }
};
