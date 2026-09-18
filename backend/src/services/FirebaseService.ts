import admin from 'firebase-admin';

const hasFirebaseConfig = () =>
  Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );

const ensureFirebaseApp = () => {
  if (admin.apps.length) return admin.app();
  if (!hasFirebaseConfig()) return null;

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  } catch (error) {
    console.error('Firebase initialize error:', error);
    return null;
  }
};

export type FcmMulticastResult = {
  ok: boolean;
  successCount: number;
  failureCount: number;
  failures: Array<{ token: string; code?: string; message?: string }>;
  messageIds: string[];
};

export const FirebaseService = {
  async sendNotification(token: string, title: string, body: string, data?: any) {
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
      const response = await admin.messaging().send(message);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Firebase notification error:', error);
      return { success: false, error };
    }
  },

  async sendMultipleNotifications(tokens: string[], title: string, body: string, data?: any) {
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
      const response = await admin.messaging().sendEachForMulticast(message);
      const failures: Array<{ token: string; code?: string; message?: string }> = [];
      const messageIds: string[] = [];

      response.responses.forEach((item, index) => {
        if (item.success) {
          if (item.messageId) messageIds.push(item.messageId);
          return;
        }
        const token = tokens[index];
        failures.push({
          token,
          code: (item.error as any)?.code,
          message: (item.error as any)?.message
        });
      });

      const result: FcmMulticastResult = {
        ok: response.failureCount === 0 && response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        failures,
        messageIds
      };

      return { success: true, result };
    } catch (error) {
      console.error('Firebase batch notification error:', error);
      return { success: false, error };
    }
  },

  async sendToTopic(topic: string, title: string, body: string, data?: any) {
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
      const response = await admin.messaging().send(message);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Firebase topic notification error:', error);
      return { success: false, error };
    }
  }
};
