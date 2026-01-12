# Shopify Frontend Integration

This document explains how the authentication flow works between the Shopify frontend (ai-coach-hero-main) and the React app (Service_TheEleFit-4).

## Overview

The integration allows users to click "Try Now" on the Shopify frontend and be seamlessly redirected to the React app with their authentication session shared.

## How It Works

### 1. Shopify Frontend (ai-coach-hero-main)

- **Location**: `ai-coach-hero-main/src/components/HeroSection.jsx`
- **Firebase Config**: `ai-coach-hero-main/src/services/firebase.js`
- **Dependencies**: Firebase SDK installed

When user clicks "Try Now":
1. Checks if user is already authenticated with Firebase
2. If authenticated, gets Firebase ID token
3. If not authenticated, attempts to log in with test credentials
4. Redirects to React app with token: `https://react-frontend-service.theelefit.com/aicoach?token={FIREBASE_ID_TOKEN}`

### 2. React App (Service_TheEleFit-4)

- **Token Handling**: `Service_TheEleFit-4/src/pages/AiCoach.js`
- **Auth Page Integration**: `Service_TheEleFit-4/src/pages/AuthPage.js`

When user arrives with token:
1. AiCoach page detects token in URL
2. Decodes token to get user email and UID
3. Checks if user exists in Firestore database
4. If user exists: redirects to auth page with pre-filled email
5. If user doesn't exist: redirects to registration page with pre-filled email
6. User logs in or registers normally with their credentials
7. After successful authentication, user is redirected to /aicoach

## Testing the Flow

### Prerequisites

1. Both applications should be running:
   - Shopify frontend: `cd ai-coach-hero-main && npm start`
   - React app: `cd Service_TheEleFit-4 && npm start`

2. Firebase should be properly configured in both apps

### Test Steps

1. **Start Shopify Frontend**:
   ```bash
   cd ai-coach-hero-main
   npm start
   ```

2. **Start React App**:
   ```bash
   cd Service_TheEleFit-4
   npm start
   ```

3. **Test the Flow**:
   - Open Shopify frontend in browser
   - Click "Try Now" button
   - Should redirect to React app with token
   - Should see pre-filled email on auth page
   - Should see "Welcome from Shopify!" message
   - Log in with credentials
   - Should be redirected to /aicoach page

### Expected Behavior

- ✅ Token is passed in URL
- ✅ Token is decoded to extract user information
- ✅ System checks if user exists in Firestore
- ✅ Email is pre-filled on auth/registration page
- ✅ Welcome message is displayed
- ✅ User can log in or register normally
- ✅ After authentication, user is redirected to /aicoach

## Configuration

### Firebase Configuration

Both apps use the same Firebase project:
- Project ID: `getfit-with-elefit`
- Auth Domain: `getfit-with-elefit.firebaseapp.com`

### URLs

- Shopify Frontend: `https://dec21b6e1071.ngrok-free.app` (ai-coach-hero-main)
- React App: `https://f21aa26bd4cd.ngrok-free.app` (Service_TheEleFit-4)
- Production URLs:
  - Shopify: `https://theelefit.com/ai-shopify-frontend-ui`
  - React App: `https://react-frontend-service.theelefit.com`

## Security Notes

- ID tokens are passed in URL (consider using POST for production)
- Tokens are decoded client-side to extract user information
- Email is pre-filled but user still needs to authenticate
- No backend required - all processing happens in React app

## Future Improvements

1. **Backend Token Verification**: Create a backend endpoint to verify ID tokens and generate custom tokens
2. **Secure Token Passing**: Use POST requests instead of URL parameters
3. **Session Management**: Implement proper session sharing between apps
4. **Error Handling**: Better error handling for failed token verification
5. **User Experience**: Seamless login without redirect to auth page

## Troubleshooting

### Common Issues

1. **Token not working**: Check Firebase configuration in both apps
2. **Email not pre-filled**: Check localStorage for 'shopify_email'
3. **Redirect not working**: Check URL format and token parameter
4. **Firebase errors**: Verify Firebase project configuration

### Debug Steps

1. Check browser console for errors
2. Verify Firebase configuration
3. Check localStorage for stored values
4. Verify URL parameters are correct
5. Test Firebase authentication separately in both apps
