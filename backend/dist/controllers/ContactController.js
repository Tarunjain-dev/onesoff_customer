"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitContact = void 0;
const mail_1 = require("../config/mail");
const submitContact = async (req, res) => {
    try {
        const { name, email, city, number, message } = req.body;
        if (!name || !email || !city || !number || !message) {
            return res.status(400).json({ success: false, message: 'All fields required' });
        }
        const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();
        const fromEmail = String(process.env.FROM_EMAIL || process.env.SMTP_USER || '').trim();
        if (!adminEmail) {
            return res.status(503).json({
                success: false,
                message: 'Contact form is not configured. Missing ADMIN_EMAIL on the backend.'
            });
        }
        if (!fromEmail) {
            return res.status(503).json({
                success: false,
                message: 'Contact form is not configured. Missing FROM_EMAIL or SMTP_USER on the backend.'
            });
        }
        await (0, mail_1.sendViaBrevoAPI)({
            to: adminEmail,
            replyTo: email,
            subject: 'New Customer Contact',
            html: `
      <div style="font-family:Arial;padding:20px;">
        <h2>New Contact Request</h2>
        <table border="1" cellpadding="10" cellspacing="0" style="border-collapse:collapse;width:100%;">
          <tr><td><strong>Name</strong></td><td>${name}</td></tr>
          <tr><td><strong>Email</strong></td><td>${email}</td></tr>
          <tr><td><strong>City</strong></td><td>${city}</td></tr>
          <tr><td><strong>Phone</strong></td><td>${number}</td></tr>
          <tr><td><strong>Message</strong></td><td>${message}</td></tr>
        </table>
      </div>
      `
        });
        return res.json({ success: true, message: 'Contact submitted' });
    }
    catch (error) {
        console.error('[ContactController] sendMail failed:', error?.message || error);
        return res.status(500).json({
            success: false,
            message: error?.message || 'Failed to send contact email'
        });
    }
};
exports.submitContact = submitContact;
