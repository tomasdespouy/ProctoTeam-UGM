
require('dotenv').config({ path: '.env.local' });
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// IMPORTANT:
// 1. Go to your Firebase project settings > Service accounts.
// 2. Click "Generate new private key" and download the file.
// 3. Rename the downloaded file to "service-account-key.json" and place it in the root of your project.
// 4. Make sure your .gitignore file includes "service-account-key.json" to keep it private.

const serviceAccount = require('../service-account-key.json');

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
} catch (error) {
  // We ignore the "already exists" error
  if (!/already exists/u.test((error as Error).message)) {
    console.error('Firebase admin initialization error', error);
  }
}

const db = admin.firestore();
const auth = admin.auth();

const TOTAL_STUDENTS = 50;

async function createStudentAccounts() {
  console.log(`Starting to create ${TOTAL_STUDENTS} student accounts...`);

  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    const studentNumber = i;
    const email = `estudiante${studentNumber}@gmail.com`;
    const password = '123456';
    const displayName = `Estudiante ${studentNumber}`;

    try {
      // Create user in Firebase Authentication
      const userRecord = await auth.createUser({
        email: email,
        password: password,
        displayName: displayName,
      });

      const uid = userRecord.uid;
      console.log(`Successfully created user: ${displayName} (${email}) with UID: ${uid}`);

      // Create user profile in Firestore
      const userDocRef = db.collection('users').doc(uid);
      await userDocRef.set({
        nombre: displayName,
        correo: email,
        role: 'student',
        creadoEn: Timestamp.now(),
      });

      console.log(` -> Firestore profile created for ${displayName}.`);

    } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
            console.warn(` - WARN: User with email ${email} already exists. Skipping.`);
        } else {
            console.error(` - ERROR creating user ${displayName}:`, error.message);
        }
    }
  }

  console.log(`\nScript finished. ${TOTAL_STUDENTS} student accounts have been processed.`);
  process.exit(0);
}

createStudentAccounts().catch((error) => {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
});
