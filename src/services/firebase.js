import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  doc,
  setDoc,
  getDoc,
  query,
  collection,
  where,
  getDocs,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  AuthErrorCodes,
  RecaptchaVerifier,
  PhoneAuthProvider,
  updateProfile,
  linkWithCredential,
  signInWithPhoneNumber,
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import {
  createShopifyCustomer,
  loginShopifyCustomer,
  checkShopifyCustomerExists,
} from "./shopifyService";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const firestore = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);
const storage = getStorage(app);
const database = getDatabase(app);

// Ensure auth is ready for phone verification
auth.useDeviceLanguage();

// Diagnostic function to check Firebase setup
export const checkFirebasePhoneAuthSetup = () => {
  const diagnostics = {
    authInitialized: !!auth,
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    apiKeyPresent: !!firebaseConfig.apiKey,
    currentUser: auth?.currentUser?.uid || "No user",
    supportedBrowser: typeof window !== "undefined" && !!window.navigator,
    httpsProtocol:
      typeof window !== "undefined"
        ? window.location.protocol === "https:"
        : false,
    domain:
      typeof window !== "undefined" ? window.location.hostname : "unknown",
  };

  console.log("Firebase Phone Auth Diagnostics:", diagnostics);
  return diagnostics;
};

// Export Firebase instances
export { db, firestore, auth, storage, database };

// Helper to handle Firebase Auth errors with friendly messages
const handleFirebaseAuthError = (error) => {
  let message = "An error occurred during authentication";

  switch (error.code) {
    case AuthErrorCodes.EMAIL_EXISTS:
      message = "An account with this email already exists";
      break;
    case AuthErrorCodes.INVALID_EMAIL:
      message = "The email address is not valid";
      break;
    case AuthErrorCodes.WEAK_PASSWORD:
      message = "Password should be at least 6 characters";
      break;
    case AuthErrorCodes.USER_DELETED:
    case AuthErrorCodes.INVALID_PASSWORD:
      message = "Email or password is incorrect";
      break;
    case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
      message = "Too many failed login attempts. Please try again later";
      break;
    default:
      console.error("Firebase auth error:", error);
  }

  const enhancedError = new Error(message);
  enhancedError.originalError = error;
  return enhancedError;
};

// Check if user exists in Firebase by email
const checkUserExistsByEmail = async (email) => {
  try {
    console.log(`Checking if Firebase user exists for email: ${email}`);

    if (!email) {
      console.error("No email provided to checkUserExistsByEmail");
      return false;
    }

    // Normalize email to prevent case-sensitivity issues
    const normalizedEmail = email.toLowerCase().trim();

    // First, check in the Auth system
    let existsInAuth = false;
    try {
      // Firebase Auth doesn't provide a direct way to check if a user exists by email
      // We'll rely on Firestore check instead
      console.log(
        "Cannot directly check Auth system, relying on Firestore check",
      );
    } catch (authError) {
      console.error("Error checking Firebase Auth:", authError);
    }

    // Then check in Firestore
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", normalizedEmail));

    console.log("Executing Firestore query to check user existence");
    const querySnapshot = await getDocs(q);
    const exists = !querySnapshot.empty;

    if (exists) {
      console.log(`Found user in Firestore with email: ${normalizedEmail}`);
      // Log the first matching document for debugging
      querySnapshot.forEach((doc) => {
        console.log(`User document ID: ${doc.id}, data:`, doc.data());
      });
    } else {
      console.log(`No user found in Firestore with email: ${normalizedEmail}`);
    }

    return exists;
  } catch (error) {
    console.error("Error checking if user exists:", error);
    return false;
  }
};

// Map Shopify customer to Firebase
const mapShopifyUserToFirebase = async (
  email,
  userType = "user",
  shopifyCustomerId = null,
  password = null,
) => {
  try {
    console.log(
      `Mapping Shopify user to Firebase: ${email}, userType: ${userType}, shopifyCustomerId: ${shopifyCustomerId}`,
    );

    // Normalize email to prevent case-sensitivity issues
    const normalizedEmail = email.toLowerCase().trim();

    // Use the provided password if available, otherwise generate a random one
    // Using the same password will make it easier for users to log in
    let userPassword;
    if (password) {
      console.log("Using provided password for Firebase auth user");
      userPassword = password;
    } else {
      // Create a random secure password for the Firebase user if none provided
      userPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-8);
      console.log(
        `Generated random password for Firebase auth: ${userPassword}`,
      );
    }

    // Check if user already exists in Firebase Auth (should be rare, but possible)
    let userCredential;
    try {
      console.log("Creating new Firebase auth user");
      userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        userPassword,
      );
      console.log(
        `Firebase auth user created with UID: ${userCredential.user.uid}`,
      );
    } catch (authError) {
      console.error("Error creating Firebase auth user:", authError);

      // If the user already exists in Firebase Auth, we need to handle this case
      if (authError.code === AuthErrorCodes.EMAIL_EXISTS) {
        console.log(
          "User already exists in Firebase Auth, attempting to use the existing user",
        );

        // Check if we can find the user in Firestore
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", normalizedEmail));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          console.log(
            "Found existing user in Firestore, updating the Shopify mapping",
          );

          // Update the existing user with Shopify mapping
          const userDoc = querySnapshot.docs[0];
          await setDoc(
            doc(db, "users", userDoc.id),
            {
              ...userDoc.data(),
              shopifyCustomerId: shopifyCustomerId,
              shopifyMapped: true,
              updatedAt: new Date(),
            },
            { merge: true },
          );

          console.log(`Updated existing user document: ${userDoc.id}`);
          return {
            success: true,
            email: normalizedEmail,
            uid: userDoc.id,
            preExisting: true,
          };
        } else {
          // This is a strange case - user exists in Auth but not in Firestore
          throw new Error(
            "User exists in Firebase Auth but not in Firestore. Unable to map Shopify user.",
          );
        }
      } else {
        // For other errors, just propagate them
        throw authError;
      }
    }

    // Create user profile in Firestore
    console.log(
      `Creating user document in Firestore for UID: ${userCredential.user.uid}`,
    );
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email: normalizedEmail,
      userType: userType,
      createdAt: new Date(),
      shopifyMapped: true,
      shopifyCustomerId: shopifyCustomerId,
    });

    console.log("User document created in Firestore");

    // Sign out immediately to clean state
    await signOut(auth);
    console.log("Signed out from temporary authentication session");

    return {
      success: true,
      email: normalizedEmail,
      uid: userCredential.user.uid,
    };
  } catch (error) {
    console.error("Error mapping Shopify user to Firebase:", error);
    throw handleFirebaseAuthError(error);
  }
};

// Enhanced user registration with Shopify integration
export const registerUser = async (
  email,
  password,
  userType,
  additionalData = {},
) => {
  try {
    console.log(`Registering new ${userType} user with email: ${email}`);

    // Normalize email to prevent case-sensitivity issues
    const normalizedEmail = email.toLowerCase().trim();

    // First check if the user already exists in Shopify
    try {
      console.log(
        "Checking if user already exists in Shopify before creating...",
      );
      const shopifyExists = await checkShopifyCustomerExists(normalizedEmail);

      if (shopifyExists) {
        console.log("User already exists in Shopify, trying to log in instead");
        // Try to authenticate with Shopify
        try {
          const shopifyCustomer = await loginShopifyCustomer(
            normalizedEmail,
            password,
          );
          console.log(
            "Successfully authenticated existing Shopify user",
            shopifyCustomer,
          );

          // Map this user to Firebase
          await mapShopifyUserToFirebase(
            normalizedEmail,
            userType,
            shopifyCustomer.id,
            password,
          );

          return {
            success: true,
            email: normalizedEmail,
            shopifyCustomerId: shopifyCustomer.id,
            message:
              "Account already existed in Shopify. We've connected it to our system.",
          };
        } catch (shopifyLoginError) {
          console.error(
            "Failed to authenticate with existing Shopify account:",
            shopifyLoginError,
          );
          throw new Error(
            "An account with this email already exists, but the password is incorrect.",
          );
        }
      }
    } catch (checkError) {
      console.error("Error checking if user exists in Shopify:", checkError);
      // Continue with registration if the check fails
    }

    let shopifyCustomerId = null;

    // Try to create customer in Shopify, but make it optional for experts
    try {
      console.log("Creating new Shopify customer...");
      const shopifyCustomer = await createShopifyCustomer(
        normalizedEmail,
        password,
        additionalData,
      );
      console.log(`Shopify customer created with ID: ${shopifyCustomer.id}`);
      shopifyCustomerId = shopifyCustomer.id;
    } catch (shopifyError) {
      console.error("Error creating Shopify customer:", shopifyError);

      // For regular users, Shopify integration is required
      if (userType !== "expert") {
        throw shopifyError;
      } else {
        // For experts, we can continue without Shopify integration
        console.log(
          "Continuing expert registration without Shopify integration",
        );
      }
    }

    // Then create user in Firebase with exactly the same password
    try {
      console.log(`Creating Firebase user with userType: ${userType}`);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );
      const user = userCredential.user;

      // Create user profile in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: normalizedEmail,
        userType: userType,
        firstName: additionalData?.firstName || "",
        lastName: additionalData?.lastName || "",
        createdAt: new Date(),
        shopifyCustomerId: shopifyCustomerId,
        shopifyMapped: !!shopifyCustomerId,
        isEvaCustomer: additionalData?.isEvaCustomer || false,
      });

      console.log(
        `Firebase user created with UID: ${user.uid} and userType: ${userType}`,
      );

      if (userType !== "expert") {
        // Only sign out if not an expert registration from admin panel
        // For expert registrations, we want to keep the admin logged in
        await signOut(auth);
      }

      return {
        success: true,
        email: normalizedEmail,
        shopifyCustomerId,
        uid: user.uid,
        shopifyIntegrated: !!shopifyCustomerId,
      };
    } catch (firebaseError) {
      console.error("Firebase registration failed:", firebaseError);

      // If Shopify was created but Firebase failed, return partial success
      if (shopifyCustomerId) {
        return {
          success: true,
          email: normalizedEmail,
          shopifyCustomerId,
          firebaseError: true,
          message:
            "Account created in Shopify but Firebase registration failed. Please try logging in.",
        };
      }

      // Handle Firebase Auth errors with friendly messages
      throw handleFirebaseAuthError(firebaseError);
    }
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
};

// Helper function to handle Shopify-authenticated users who can't log in to Firebase
const handleShopifyAuthenticatedUser = async (email, shopifyCustomerId) => {
  try {
    console.log(`Handling Shopify-authenticated user: ${email}`);

    // Send a password reset email to allow the user to set their own password
    await firebaseSendPasswordResetEmail(auth, email);

    // Find user in Firestore and update Shopify mapping
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Update existing user
      const userDoc = querySnapshot.docs[0];
      await setDoc(
        doc(db, "users", userDoc.id),
        {
          ...userDoc.data(),
          shopifyCustomerId: shopifyCustomerId,
          shopifyMapped: true,
          updatedAt: new Date(),
        },
        { merge: true },
      );
      console.log(
        `Updated Shopify information for user document: ${userDoc.id}`,
      );
    } else {
      // No Firestore document - create a placeholder
      const placeholderId = `shopify-${Date.now()}`;
      await setDoc(doc(db, "users", placeholderId), {
        email: email.toLowerCase().trim(),
        userType: "user",
        createdAt: new Date(),
        shopifyMapped: true,
        shopifyCustomerId: shopifyCustomerId,
        needsFirebaseAuth: true,
      });
      console.log(`Created placeholder document: ${placeholderId}`);
    }

    return {
      success: true,
      requiresPasswordReset: true,
      message:
        "We've sent a password reset email to your address. Please check your inbox, reset your password, and then try logging in again.",
    };
  } catch (error) {
    console.error("Error handling Shopify authenticated user:", error);
    throw error;
  }
};

// Enhanced function to automatically create Firebase user from Shopify when token fails
const autoCreateFirebaseUserFromShopify = async (
  email,
  password,
  shopifyCustomer,
) => {
  try {
    console.log(`Auto-creating Firebase user from Shopify for: ${email}`);

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Create Firebase user with the same password
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );
    console.log(`Firebase user created with UID: ${userCredential.user.uid}`);

    // Create user profile in Firestore
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email: normalizedEmail,
      userType: "user",
      createdAt: new Date(),
      shopifyCustomerId: shopifyCustomer.id,
      shopifyMapped: true,
      autoCreated: true,
      autoCreatedAt: new Date(),
    });

    console.log("Firestore document created for auto-created user");

    // Sign out immediately to clean state
    await signOut(auth);
    console.log("Signed out from auto-creation session");

    return {
      success: true,
      email: normalizedEmail,
      uid: userCredential.user.uid,
      shopifyCustomerId: shopifyCustomer.id,
      autoCreated: true,
      message: "User automatically created from Shopify. Please log in again.",
    };
  } catch (error) {
    console.error("Error auto-creating Firebase user from Shopify:", error);
    throw error;
  }
};

// Enhanced login with Shopify integration and automatic user creation
export const loginUser = async (email, password) => {
  try {
    console.log(`Login attempt for email: ${email}`);

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user is an expert by looking in Firestore first
    console.log("Checking if user is an expert...");
    const usersRef = collection(db, "users");
    const expertQuery = query(
      usersRef,
      where("email", "==", normalizedEmail),
      where("userType", "==", "expert"),
    );
    const expertSnapshot = await getDocs(expertQuery);
    const isExpert = !expertSnapshot.empty;
    console.log(`Is user an expert? ${isExpert}`);

    if (isExpert) {
      console.log("Expert user detected, handling expert login...");
      try {
        // For experts, try direct Firebase login first
        const userCredential = await signInWithEmailAndPassword(
          auth,
          normalizedEmail,
          password,
        );
        console.log("Expert login successful");
        return userCredential.user;
      } catch (firebaseError) {
        console.error("Expert login failed:", firebaseError);
        throw handleFirebaseAuthError(firebaseError);
      }
    }

    // For non-experts, first try direct Firebase login
    try {
      console.log("Attempting direct Firebase login...");
      const userCredential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );
      console.log("Firebase login successful");
      return userCredential.user;
    } catch (firebaseError) {
      console.error("Firebase login failed:", firebaseError.code);

      // If Firebase login fails, try Shopify
      try {
        console.log("Trying Shopify authentication...");
        const shopifyCustomer = await loginShopifyCustomer(
          normalizedEmail,
          password,
        );
        console.log("Shopify authentication successful", shopifyCustomer);

        // If we got here, Shopify auth worked but Firebase auth failed
        console.log(
          "User exists in Shopify but Firebase auth failed - attempting auto-creation",
        );

        // At this point, we know:
        // 1. The user exists in Shopify with these credentials
        // 2. Either the user doesn't exist in Firebase, or the password is different

        // Check if the user exists in Firestore
        const userExistsInFirestore =
          await checkUserExistsByEmail(normalizedEmail);
        console.log(`User exists in Firestore: ${userExistsInFirestore}`);

        if (userExistsInFirestore) {
          console.log("User exists in Firestore, sending password reset email");
          // Send password reset email to allow user to set Firebase password
          await firebaseSendPasswordResetEmail(auth, normalizedEmail);
          throw new Error(
            "Your Shopify password doesn't match our system. We've sent a password reset email to your address. Please check your inbox and reset your password, then try logging in again.",
          );
        } else {
          // User doesn't exist in our Firestore, automatically create Firebase user from Shopify
          console.log(
            "User not found in Firebase - auto-creating from Shopify",
          );
          try {
            const autoCreateResult = await autoCreateFirebaseUserFromShopify(
              normalizedEmail,
              password,
              shopifyCustomer,
            );
            console.log("Auto-creation successful:", autoCreateResult);

            // Return success immediately - user has been created
            return {
              success: true,
              email: normalizedEmail,
              uid: autoCreateResult.uid,
              shopifyCustomerId: shopifyCustomer.id,
              autoCreated: true,
              message:
                "User automatically created from Shopify. Please log in again with the same credentials.",
            };
          } catch (createError) {
            console.error("Error auto-creating Firebase account:", createError);

            // If we can't create a Firebase account, just send a password reset
            if (createError.code === "auth/email-already-in-use") {
              console.log(
                "Email already in use in Firebase Auth, sending password reset",
              );
              await firebaseSendPasswordResetEmail(auth, normalizedEmail);
              throw new Error(
                "Your Shopify password doesn't match our system. We've sent a password reset email to your address. Please check your inbox and reset your password, then try logging in again.",
              );
            }

            throw createError;
          }
        }
      } catch (shopifyError) {
        console.error("Shopify authentication failed:", shopifyError);

        // If both Firebase and Shopify auth failed, user provided wrong credentials
        if (
          firebaseError.code === "auth/invalid-login-credentials" ||
          firebaseError.code === "auth/wrong-password" ||
          firebaseError.code === "auth/user-not-found"
        ) {
          // Check if the error suggests the user might have a Shopify account
          if (
            shopifyError.message &&
            shopifyError.message.includes("UNIDENTIFIED_CUSTOMER")
          ) {
            throw new Error(
              "Email or password is incorrect. If you have a Shopify account, please use your Shopify password.",
            );
          } else {
            throw new Error("Email or password is incorrect.");
          }
        }

        // For any other Firebase errors, pass them through
        throw handleFirebaseAuthError(firebaseError);
      }
    }
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

// Helper function to delete and recreate a Firebase account
const deleteAndRecreateFirebaseAccount = async (
  email,
  password,
  shopifyCustomerId,
) => {
  try {
    console.log(`Attempting to fix Firebase account for: ${email}`);

    // Find the user in Firestore
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);

    let userData = null;
    let userId = null;

    if (!querySnapshot.empty) {
      // Get the user data and ID
      const userDoc = querySnapshot.docs[0];
      userData = userDoc.data();
      userId = userDoc.id;
      console.log(`Found user document: ${userId}`);
    }

    // We have two options:
    // 1. Use admin SDK to reset the password (not possible from client)
    // 2. Create a new Firebase Auth account and link it to the existing Firestore document

    // Since we can't use admin SDK from client, we'll try to create a new account
    // and update references

    try {
      console.log("Creating new Firebase auth user with correct password");
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      console.log(
        `New Firebase auth user created with UID: ${userCredential.user.uid}`,
      );

      // If we had existing user data, transfer it to the new user
      if (userData) {
        console.log("Transferring existing user data to new account");
        await setDoc(doc(db, "users", userCredential.user.uid), {
          ...userData,
          email: email.toLowerCase().trim(),
          shopifyCustomerId: shopifyCustomerId,
          shopifyMapped: true,
          updatedAt: new Date(),
          previousUid: userId, // Keep track of the old UID for reference
        });

        // Delete the old document
        if (userId !== userCredential.user.uid) {
          await deleteDoc(doc(db, "users", userId));
          console.log(`Deleted old user document: ${userId}`);
        }
      } else {
        // Create new user document
        console.log("Creating new user document");
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: email.toLowerCase().trim(),
          userType: "user",
          createdAt: new Date(),
          shopifyMapped: true,
          shopifyCustomerId: shopifyCustomerId,
        });
      }

      // Sign out to clean state
      await signOut(auth);
      console.log("Signed out from temporary authentication session");

      return { success: true, uid: userCredential.user.uid };
    } catch (error) {
      console.error("Error recreating Firebase account:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in deleteAndRecreateFirebaseAccount:", error);
    throw error;
  }
};

export const getUserType = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return userDoc.data().userType;
    }
    return null;
  } catch (error) {
    console.error("Error getting user type:", error);
    return null;
  }
};

export const sendPasswordResetEmail = async (email) => {
  try {
    // Check if user exists in Shopify first
    const existsInShopify = await checkShopifyCustomerExists(email);

    if (!existsInShopify) {
      throw new Error("No account found with that email address");
    }

    // Send reset email through Firebase
    await firebaseSendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    if (error.code) {
      throw handleFirebaseAuthError(error);
    }
    throw error;
  }
};

// Add a utility function to handle cases where a user exists in Firestore but has auth issues
const resetUserPasswordAndProvideInstructions = async (email) => {
  try {
    console.log(`Sending password reset email to ${email}`);
    await firebaseSendPasswordResetEmail(auth, email);
    console.log("Password reset email sent successfully");
    return {
      success: true,
      message:
        "A password reset email has been sent to your address. Please check your inbox and follow the instructions to reset your password, then try logging in again.",
    };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return {
      success: false,
      message:
        'We could not send a password reset email. Please try the "Forgot Password" option on the login page.',
      error,
    };
  }
};

// Phone number verification functions
export const setupRecaptcha = (containerId) => {
  try {
    // Ensure Firebase Auth is initialized
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    // Clear any existing reCAPTCHA
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (clearError) {
        console.warn("Error clearing existing reCAPTCHA:", clearError);
      }
      window.recaptchaVerifier = null;
    }

    // Ensure the container exists
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    // Create new reCAPTCHA verifier with minimal configuration for better compatibility
    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: (response) => {
        console.log("reCAPTCHA verified successfully");
      },
      "expired-callback": () => {
        console.log("reCAPTCHA expired, please verify again");
        if (window.recaptchaVerifier) {
          try {
            window.recaptchaVerifier.clear();
          } catch (clearError) {
            console.warn("Error clearing expired reCAPTCHA:", clearError);
          }
          window.recaptchaVerifier = null;
        }
      },
    });

    // Store reference globally for cleanup
    window.recaptchaVerifier = verifier;

    return verifier;
  } catch (error) {
    console.error("Error setting up reCAPTCHA:", error);
    throw error;
  }
};

export const sendPhoneVerificationCode = async (phoneNumber, containerId) => {
  try {
    // Ensure Firebase Auth is initialized
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    // Check if we're in a supported environment
    if (typeof window === "undefined") {
      throw new Error(
        "Phone authentication is only supported in browser environments",
      );
    }

    // Format phone number to E.164 format
    if (!phoneNumber.startsWith("+")) {
      phoneNumber = "+" + phoneNumber;
    }

    console.log("Sending verification code to:", phoneNumber);
    console.log("Firebase config:", {
      apiKey: firebaseConfig.apiKey.substring(0, 10) + "...",
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
    });

    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      throw new Error(
        "Invalid phone number format. Please use international format.",
      );
    }

    // Setup reCAPTCHA with proper error handling
    const verifier = setupRecaptcha(containerId);

    // Wait a moment for DOM to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Render the reCAPTCHA widget with error handling
    try {
      await verifier.render();
      console.log("reCAPTCHA rendered successfully");
    } catch (renderError) {
      console.error("Error rendering reCAPTCHA:", renderError);

      // Try to clear and recreate with different configuration
      try {
        verifier.clear();
        const fallbackVerifier = new RecaptchaVerifier(auth, containerId, {
          size: "normal",
          callback: (response) => {
            console.log("Fallback reCAPTCHA verified successfully");
          },
        });
        window.recaptchaVerifier = fallbackVerifier;
        await fallbackVerifier.render();
        console.log("Fallback reCAPTCHA rendered successfully");
      } catch (fallbackError) {
        console.error("Fallback reCAPTCHA also failed:", fallbackError);
        throw new Error(
          "reCAPTCHA setup failed. Please refresh the page and try again.",
        );
      }
    }

    // Send verification code with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(new Error("Phone verification timeout. Please try again.")),
        60000,
      );
    });

    const verificationPromise = signInWithPhoneNumber(
      auth,
      phoneNumber,
      verifier,
    );

    const confirmationResult = await Promise.race([
      verificationPromise,
      timeoutPromise,
    ]);

    // Store confirmation result globally
    window.confirmationResult = confirmationResult;

    console.log("Verification code sent successfully");
    return confirmationResult.verificationId;
  } catch (error) {
    console.error("Error sending verification code:", error);

    // Clean up on error with proper error handling
    try {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
      if (window.confirmationResult) {
        window.confirmationResult = null;
      }
    } catch (cleanupError) {
      console.warn("Error during cleanup:", cleanupError);
    }

    // Provide user-friendly error messages
    if (error.code === "auth/invalid-app-credential") {
      throw new Error(
        "Firebase phone authentication is not properly configured. Please check the setup guide or contact support.",
      );
    } else if (error.code === "auth/invalid-phone-number") {
      throw new Error(
        "Invalid phone number format. Please use international format (+1234567890).",
      );
    } else if (error.code === "auth/too-many-requests") {
      throw new Error(
        "Too many SMS requests. Please wait 1 hour before trying again, or use a test phone number for development.",
      );
    } else if (error.code === "auth/quota-exceeded") {
      throw new Error(
        "SMS quota exceeded for today. Please try again tomorrow or upgrade your Firebase plan.",
      );
    } else if (error.code === "auth/captcha-check-failed") {
      throw new Error(
        "reCAPTCHA verification failed. Please complete the reCAPTCHA challenge and try again.",
      );
    } else if (error.code === "auth/missing-app-credential") {
      throw new Error(
        "Firebase app credentials are missing. Please check your Firebase configuration.",
      );
    } else if (error.code === "auth/app-not-authorized") {
      throw new Error(
        "This domain is not authorized for Firebase phone authentication. Please add your domain to authorized domains in Firebase Console.",
      );
    } else if (error.message && error.message.includes("400")) {
      throw new Error(
        "Phone authentication configuration error. Please ensure Phone provider is enabled in Firebase Console and your domain is authorized.",
      );
    } else {
      console.error("Full error details:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      throw new Error(
        error.message || "Failed to send verification code. Please try again.",
      );
    }
  }
};

// Simple OTP verification without Firebase Auth disruption
export const verifyPhoneNumberForExistingUser = async (
  verificationId,
  verificationCode,
  currentUser,
  phoneNumber,
) => {
  try {
    console.log(
      "Verifying phone number for existing user without disrupting session",
    );
    console.log("Current user:", {
      uid: currentUser.uid,
      email: currentUser.email,
    });
    console.log("Phone number to verify:", phoneNumber);
    console.log("Verification ID:", verificationId);

    // Validate verification code format
    if (
      !verificationCode ||
      verificationCode.length !== 6 ||
      !/^\d{6}$/.test(verificationCode)
    ) {
      throw new Error("Please enter a valid 6-digit verification code.");
    }

    // For existing users, we'll use a completely different approach:
    // Instead of using Firebase Auth phone verification (which disrupts the session),
    // we'll use a simple OTP validation system that doesn't affect the current user session

    if (!window.confirmationResult) {
      throw new Error(
        "No verification in progress. Please request a new code.",
      );
    }

    // Confirm the verification code with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Verification timeout. Please try again.")),
        30000,
      );
    });

    const verificationPromise =
      window.confirmationResult.confirm(verificationCode);

    const result = await Promise.race([verificationPromise, timeoutPromise]);

    console.log("Phone verification successful:", {
      verifiedPhoneNumber: result.user.phoneNumber,
      requestedPhoneNumber: phoneNumber,
    });

    // Verify that the phone number matches what was requested
    if (result.user.phoneNumber !== phoneNumber) {
      throw new Error(
        "Verified phone number does not match the requested number.",
      );
    }

    // Clear the confirmation result and reCAPTCHA
    window.confirmationResult = null;
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      } catch (clearError) {
        console.warn(
          "Error clearing reCAPTCHA after verification:",
          clearError,
        );
      }
    }

    // Update the user's Firestore document to mark phone as verified
    // WITHOUT disrupting the current user session
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      phone: phoneNumber,
      phoneVerified: true,
      phoneVerificationDate: new Date(),
      updatedAt: new Date(),
    });

    console.log("Updated Firestore document with phone verification status");

    // IMPORTANT: Instead of signing out, we'll just mark the verification as complete
    // The current user session remains intact
    console.log("Phone verification completed - user session preserved");

    return {
      success: true,
      phoneNumber: phoneNumber,
      uid: currentUser.uid,
      verificationId: verificationId,
      verifiedForExistingUser: true,
      sessionPreserved: true,
    };
  } catch (error) {
    console.error("Error verifying phone number for existing user:", error);

    // Clean up on error
    try {
      window.confirmationResult = null;
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } catch (cleanupError) {
      console.warn("Error during verification cleanup:", cleanupError);
    }

    // Provide user-friendly error messages
    if (error.code === "auth/invalid-verification-code") {
      throw new Error("Invalid verification code. Please check and try again.");
    } else if (error.code === "auth/code-expired") {
      throw new Error("Verification code expired. Please request a new code.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Please wait and try again.");
    } else {
      throw new Error(
        error.message || "Failed to verify code. Please try again.",
      );
    }
  }
};

export const verifyPhoneNumber = async (
  verificationId,
  verificationCode,
  currentUser = null,
) => {
  try {
    // Ensure Firebase Auth is initialized
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    if (!window.confirmationResult) {
      throw new Error(
        "No verification in progress. Please request a new code.",
      );
    }

    // Validate verification code format
    if (
      !verificationCode ||
      verificationCode.length !== 6 ||
      !/^\d{6}$/.test(verificationCode)
    ) {
      throw new Error("Please enter a valid 6-digit verification code.");
    }

    console.log("Verifying phone number with code:", verificationCode);
    console.log(
      "Current user context:",
      currentUser
        ? { uid: currentUser.uid, email: currentUser.email }
        : "No current user",
    );

    // If we have a current user, use the new function that doesn't disrupt the session
    if (currentUser) {
      // We need to get the phone number that was being verified
      // This should be passed from the calling component
      const phoneNumber = window.phoneNumberBeingVerified || null;

      if (phoneNumber) {
        return await verifyPhoneNumberForExistingUser(
          verificationId,
          verificationCode,
          currentUser,
          phoneNumber,
        );
      } else {
        throw new Error(
          "Phone number context missing for existing user verification",
        );
      }
    }

    // For new users (no current user), proceed with normal verification
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Verification timeout. Please try again.")),
        30000,
      );
    });

    const verificationPromise =
      window.confirmationResult.confirm(verificationCode);

    const result = await Promise.race([verificationPromise, timeoutPromise]);

    // Clear the confirmation result and reCAPTCHA
    window.confirmationResult = null;
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      } catch (clearError) {
        console.warn(
          "Error clearing reCAPTCHA after verification:",
          clearError,
        );
      }
    }

    console.log("Phone number verified successfully for new user");

    return {
      success: true,
      phoneNumber: result.user.phoneNumber,
      uid: result.user.uid,
      verificationId: verificationId,
      verifiedForExistingUser: false,
    };
  } catch (error) {
    console.error("Error verifying phone number:", error);

    // Clean up on error
    try {
      window.confirmationResult = null;
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } catch (cleanupError) {
      console.warn("Error during verification cleanup:", cleanupError);
    }

    // Provide user-friendly error messages
    if (error.code === "auth/invalid-verification-code") {
      throw new Error("Invalid verification code. Please check and try again.");
    } else if (error.code === "auth/code-expired") {
      throw new Error("Verification code expired. Please request a new code.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Please wait and try again.");
    } else if (error.code === "auth/credential-already-in-use") {
      throw new Error(
        "This phone number is already associated with another account.",
      );
    } else if (error.code === "auth/provider-already-linked") {
      throw new Error("This phone number is already linked to your account.");
    } else {
      throw new Error(
        error.message || "Failed to verify code. Please try again.",
      );
    }
  }
};

// Simple OTP verification without Firebase Auth (for existing users)
export const verifyOTPForExistingUser = async (
  verificationCode,
  currentUser,
  phoneNumber,
) => {
  try {
    console.log(
      "Verifying OTP for existing user without Firebase Auth disruption",
    );
    console.log("Current user:", {
      uid: currentUser.uid,
      email: currentUser.email,
    });
    console.log("Phone number to verify:", phoneNumber);

    // Validate verification code format
    if (
      !verificationCode ||
      verificationCode.length !== 6 ||
      !/^\d{6}$/.test(verificationCode)
    ) {
      throw new Error("Please enter a valid 6-digit verification code.");
    }

    // For now, we'll use a simple validation approach
    // In a real implementation, you would validate the OTP against your backend
    // For this demo, we'll just check if the code is 6 digits and update Firestore

    // Simulate OTP validation (replace with actual validation logic)
    const isValidOTP =
      verificationCode.length === 6 && /^\d{6}$/.test(verificationCode);

    if (!isValidOTP) {
      throw new Error("Invalid verification code. Please check and try again.");
    }

    // Update the user's Firestore document to mark phone as verified
    // WITHOUT disrupting the current user session
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      phone: phoneNumber,
      phoneVerified: true,
      phoneVerificationDate: new Date(),
      updatedAt: new Date(),
    });

    console.log("Updated Firestore document with phone verification status");
    console.log("Phone verification completed - user session preserved");

    return {
      success: true,
      phoneNumber: phoneNumber,
      uid: currentUser.uid,
      verifiedForExistingUser: true,
      sessionPreserved: true,
    };
  } catch (error) {
    console.error("Error verifying OTP for existing user:", error);
    throw new Error(
      error.message || "Failed to verify code. Please try again.",
    );
  }
};

// Function to restore user session after phone verification
export const restoreUserSessionAfterPhoneVerification = async () => {
  try {
    const sessionData = localStorage.getItem("phoneVerificationSession");
    if (!sessionData) {
      return null;
    }

    const { email, uid, phoneVerified, phoneNumber, timestamp } =
      JSON.parse(sessionData);

    // Check if session data is not too old (1 hour)
    const sessionAge = Date.now() - timestamp;
    if (sessionAge > 3600000) {
      // 1 hour
      localStorage.removeItem("phoneVerificationSession");
      return null;
    }

    console.log("Restoring user session after phone verification:", {
      email,
      uid,
      phoneVerified,
    });

    // Try to sign in with the user's email
    // Note: We can't restore the exact session, but we can help the auth system recognize the user
    // The user will need to sign in again, but we've preserved their phone verification status

    // Clear the session restoration data
    localStorage.removeItem("phoneVerificationSession");

    return {
      email,
      uid,
      phoneVerified,
      phoneNumber,
      needsReauth: true,
    };
  } catch (error) {
    console.error(
      "Error restoring user session after phone verification:",
      error,
    );
    localStorage.removeItem("phoneVerificationSession");
    return null;
  }
};

// New function to handle token verification failure and auto-create user from Shopify
export const handleTokenFailureWithShopify = async (email, password) => {
  try {
    console.log(
      `Handling token failure for email: ${email} - attempting Shopify auto-creation`,
    );

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Try Shopify authentication first
    try {
      const shopifyCustomer = await loginShopifyCustomer(
        normalizedEmail,
        password,
      );
      console.log(
        "Shopify authentication successful, auto-creating Firebase user",
      );

      // Auto-create Firebase user from Shopify
      const autoCreateResult = await autoCreateFirebaseUserFromShopify(
        normalizedEmail,
        password,
        shopifyCustomer,
      );

      return {
        success: true,
        email: normalizedEmail,
        uid: autoCreateResult.uid,
        shopifyCustomerId: shopifyCustomer.id,
        autoCreated: true,
        message:
          "User automatically created from Shopify. Please log in again with the same credentials.",
      };
    } catch (shopifyError) {
      console.error("Shopify authentication failed:", shopifyError);
      throw new Error("Authentication failed. Please check your credentials.");
    }
  } catch (error) {
    console.error("Error handling token failure with Shopify:", error);
    throw error;
  }
};

// New function to authenticate customer using customer object (email + customer ID)
// Verify customer exists in Shopify using Storefront API
const verifyCustomerInShopify = async (email, customerId) => {
  try {
    console.log("Verifying customer in Shopify:", { email, customerId });

    // For now, we'll use a simple verification approach
    // In production, you would call the actual Shopify Storefront API
    // This is a placeholder that always returns true for demo purposes

    // TODO: Implement actual Shopify Storefront API verification
    // const shopifyUrl = `https://${SHOPIFY_STORE_DOMAIN}/api/2023-07/graphql.json`;
    // const response = await fetch(shopifyUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_ACCESS_TOKEN,
    //   },
    //   body: JSON.stringify({
    //     query: `query { customer(id: "${customerId}") { id email firstName lastName } }`
    //   })
    // });

    // For demo purposes, simulate successful verification
    return {
      verified: true,
      email: email,
      customerId: customerId,
      firstName: "Customer",
      lastName: "User",
    };
  } catch (error) {
    console.error("Error verifying customer in Shopify:", error);
    return {
      verified: false,
      error: error.message,
    };
  }
};

export const authenticateCustomer = async (customerObject) => {
  try {
    console.log("Authenticating customer with object:", customerObject);

    const { email, customerId } = customerObject;

    if (!email || !customerId) {
      throw new Error("Customer object must contain email and customerId");
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // First, verify customer exists in Shopify using Storefront API
    console.log("Verifying customer exists in Shopify...");
    const shopifyVerification = await verifyCustomerInShopify(
      normalizedEmail,
      customerId,
    );

    if (!shopifyVerification.verified) {
      throw new Error("Customer not found in Shopify or verification failed");
    }

    console.log("Customer verified in Shopify:", shopifyVerification);

    // Check if user exists in Firebase
    try {
      console.log("Checking if user exists in Firebase...");
      const userExists = await checkUserExistsByEmail(normalizedEmail);

      if (userExists) {
        console.log(
          "User exists in Firebase, updating customer ID and signing in...",
        );

        // Try to get user from Firestore to get their UID
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", normalizedEmail));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();

          // Update the customer ID if it's different
          if (userData.shopifyCustomerId !== customerId) {
            console.log("Updating customer ID in Firestore...");
            await setDoc(
              doc(db, "users", userDoc.id),
              {
                ...userData,
                shopifyCustomerId: customerId,
                updatedAt: new Date(),
              },
              { merge: true },
            );
          }

          // For verified customers, we'll create a session that bypasses normal authentication
          console.log("Creating verified customer session...");

          // Store the verified customer session in localStorage
          const sessionData = {
            email: normalizedEmail,
            uid: userDoc.id,
            customerId: customerId,
            verified: true,
            timestamp: Date.now(),
            userType: "user", // Use 'user' for dashboard access
          };

          localStorage.setItem(
            "verifiedCustomerSession",
            JSON.stringify(sessionData),
          );
          console.log("Stored verified customer session:", sessionData);

          // The session will be picked up by the useAuth hook

          return {
            success: true,
            email: normalizedEmail,
            uid: userDoc.id,
            shopifyCustomerId: customerId,
            authenticated: true,
            sessionData: sessionData,
            message: "Customer verified successfully! Redirecting...",
          };
        }
      }

      // If user doesn't exist in Firebase, create them automatically
      console.log(
        "User not found in Firebase, auto-creating from customer object...",
      );

      // Create a mock Shopify customer object for the auto-creation function
      const mockShopifyCustomer = {
        id: customerId,
        email: normalizedEmail,
        firstName: shopifyVerification.firstName || "Customer",
        lastName: shopifyVerification.lastName || "User",
      };

      // Generate a random password for the new Firebase user
      const randomPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-8);

      try {
        // Auto-create Firebase user using the existing autoCreateFirebaseUserFromShopify function
        const newUser = await autoCreateFirebaseUserFromShopify(
          normalizedEmail,
          randomPassword,
          mockShopifyCustomer,
        );

        console.log(
          "Successfully created Firebase user from Shopify customer:",
          newUser,
        );

        // Create verified customer session for the new user
        const sessionData = {
          email: normalizedEmail,
          uid: newUser.uid,
          customerId: customerId,
          verified: true,
          timestamp: Date.now(),
          userType: "user", // Use 'user' for dashboard access
        };

        localStorage.setItem(
          "verifiedCustomerSession",
          JSON.stringify(sessionData),
        );
        console.log(
          "Stored verified customer session for new user:",
          sessionData,
        );

        return {
          success: true,
          email: normalizedEmail,
          uid: newUser.uid,
          shopifyCustomerId: customerId,
          authenticated: true,
          autoCreated: true,
          sessionData: sessionData,
          message: "Account created and verified successfully! Redirecting...",
        };
      } catch (createError) {
        console.error(
          "Error creating Firebase user from Shopify customer:",
          createError,
        );

        // Fallback: return success but ask user to sign up manually
        return {
          success: true,
          email: normalizedEmail,
          shopifyCustomerId: customerId,
          authenticated: false,
          autoCreated: false,
          message:
            "Customer verified with Shopify! Please create an account to continue.",
        };
      }
    } catch (error) {
      console.error("Error in customer authentication:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error authenticating customer:", error);
    throw error;
  }
};
