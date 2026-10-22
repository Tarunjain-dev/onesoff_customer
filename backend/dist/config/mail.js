"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendViaBrevoAPI = exports.getTransporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Brevo HTTP API sender — avoids SMTP port 587 which is blocked on Render/cloud hosts
const sendViaBrevoAPI = async (options) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey)
        throw new Error('BREVO_API_KEY is not set');
    const fromEmail = String(process.env.FROM_EMAIL || process.env.SMTP_USER || '').trim();
    const fromName = process.env.FROM_NAME ? String(process.env.FROM_NAME).trim() : fromEmail.split('@')[0];
    const body = {
        sender: { name: fromName, email: fromEmail },
        to: [{ email: String(options.to) }],
        replyTo: options.replyTo ? { email: String(options.replyTo) } : undefined,
        subject: String(options.subject || ''),
        htmlContent: String(options.html || '')
    };
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Brevo API error ${res.status}: ${text}`);
    }
};
exports.sendViaBrevoAPI = sendViaBrevoAPI;
const getTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = port === 465;
    if (!host || !user || !pass) {
        throw new Error(`SMTP not configured. Missing: ${[
            !host && 'SMTP_HOST',
            !user && 'SMTP_USER',
            !pass && 'SMTP_PASS'
        ].filter(Boolean).join(', ')}`);
    }
    return nodemailer_1.default.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
    });
};
exports.getTransporter = getTransporter;
