import { initializeApp, getApps, cert } from 'firebase-admin/app';

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
};

export function getFirebaseAdminApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseAdminConfig);
  }
  return getApps()[0];
}
