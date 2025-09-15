// Simple script to create a test user in Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAKB_vaOdrLCe30yJsnP2V1opiT-cZEctc",
  authDomain: "getfit-with-elefit.firebaseapp.com",
  projectId: "getfit-with-elefit",
  storageBucket: "getfit-with-elefit.firebasestorage.app",
  messagingSenderId: "302421573042",
  appId: "1:302421573042:web:632ddfadb49a1d0f5338ab",
  measurementId: "G-T02PFM264G"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      'testuser1@gmail.com', 
      'Testuser1@gmail.com'
    );
    
    console.log('Firebase Auth user created:', userCredential.user.uid);
    
    // Create Firestore user document
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email: 'testuser1@gmail.com',
      userType: 'user',
      createdAt: new Date(),
      firstName: 'Test',
      lastName: 'User'
    });
    
    console.log('Firestore user document created');
    console.log('Test user created successfully!');
    
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

createTestUser();
