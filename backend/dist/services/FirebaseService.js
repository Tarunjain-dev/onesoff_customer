"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseService = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const hasFirebaseConfig = () => Boolean(process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY);
const ensureFirebaseApp = () => {
    if (firebase_admin_1.default.apps.length)
        return firebase_admin_1.default.app();
    if (!hasFirebaseConfig())
        return null;
    try {
        return firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        });
    }
    catch (error) {
        console.error('Firebase initialize error:', error);
        return null;
    }
};
exports.FirebaseService = {
    async sendNotification(token, title, body, data) {
        const app = ensureFirebaseApp();
        if (!app) {
            return { success: false, error: 'Firebase is not configured' };
        }
        const message = {
            notification: {
                title,
                body
            },
            data: data || {},
            token
        };
        try {
            const response = await firebase_admin_1.default.messaging().send(message);
            return { success: true, messageId: response };
        }
        catch (error) {
            console.error('Firebase notification error:', error);
            return { success: false, error };
        }
    },
    async sendMultipleNotifications(tokens, title, body, data) {
        const app = ensureFirebaseApp();
        if (!app) {
            return { success: false, error: 'Firebase is not configured' };
        }
        const message = {
            notification: {
                title,
                body
            },
            data: data || {},
            tokens
        };
        try {
            const response = await firebase_admin_1.default.messaging().sendEachForMulticast(message);
            const failures = [];
            const messageIds = [];
            response.responses.forEach((item, index) => {
                if (item.success) {
                    if (item.messageId)
                        messageIds.push(item.messageId);
                    return;
                }
                const token = tokens[index];
                failures.push({
                    token,
                    code: item.error?.code,
                    message: item.error?.message
                });
            });
            const result = {
                ok: response.failureCount === 0 && response.successCount > 0,
                successCount: response.successCount,
                failureCount: response.failureCount,
                failures,
                messageIds
            };
            return { success: true, result };
        }
        catch (error) {
            console.error('Firebase batch notification error:', error);
            return { success: false, error };
        }
    },
    async sendToTopic(topic, title, body, data) {
        const app = ensureFirebaseApp();
        if (!app) {
            return { success: false, error: 'Firebase is not configured' };
        }
        const message = {
            notification: {
                title,
                body
            },
            data: data || {},
            topic
        };
        try {
            const response = await firebase_admin_1.default.messaging().send(message);
            return { success: true, messageId: response };
        }
        catch (error) {
            console.error('Firebase topic notification error:', error);
            return { success: false, error };
        }
    }
};
