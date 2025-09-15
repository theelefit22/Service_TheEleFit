# Authentication Guard System

This document explains the comprehensive Authentication Guard (Route Guard with Redirect After Login) system implemented in the React application.

## Overview

The Authentication Guard system provides:
- **Route Protection**: Prevents unauthorized access to protected routes
- **User Type Validation**: Ensures users can only access routes appropriate for their role
- **Automatic Redirects**: Redirects users to their intended destination after login
- **Shopify Integration**: Handles token-based authentication from Shopify frontend
- **Context Management**: Centralized authentication state management

## Components

### 1. AuthGuard (`src/components/AuthGuard.js`)

The main authentication guard component that protects routes based on authentication requirements.

**Props:**
- `requireAuth` (boolean): Whether the route requires authentication
- `allowedUserTypes` (array): Array of user types allowed to access the route
- `children`: The component to render if access is granted

**Features:**
- Checks authentication status
- Validates user types
- Handles redirect after login
- Shows loading states
- Redirects unauthenticated users to login

### 2. ShopifyAuthGuard (`src/components/ShopifyAuthGuard.js`)

Specialized guard for handling Shopify token authentication.

**Features:**
- Processes Shopify tokens from URL
- Decodes Firebase ID tokens
- Checks user existence in Firestore
- Redirects to appropriate auth/registration page
- Pre-fills email from token
- Shows processing states

### 3. useAuth Hook (`src/hooks/useAuth.js`)

Custom hook for managing authentication state and operations.

**Returns:**
- `user`: Current Firebase user object
- `userType`: User type from Firestore ('user', 'expert', etc.)
- `isLoading`: Loading state
- `isAuthenticated`: Authentication status
- `login(email, password)`: Login function
- `logout()`: Logout function
- `register(email, password, userType, additionalData)`: Registration function

### 4. AuthContext (`src/contexts/AuthContext.js`)

React context provider for sharing authentication state across the app.

**Usage:**
```jsx
import { useAuthContext } from '../contexts/AuthContext';

const MyComponent = () => {
  const { user, userType, isAuthenticated } = useAuthContext();
  // Use authentication state
};
```

### 5. RedirectAfterLogin (`src/components/RedirectAfterLogin.js`)

Component for handling post-login redirects to intended destinations.

**Features:**
- Reads redirect parameter from URL
- Redirects to intended destination
- Falls back to appropriate dashboard
- Shows loading state during redirect

## Route Protection Examples

### Basic Protected Route
```jsx
<Route path="/protected" element={
  <ProtectedRoute>
    <ProtectedComponent />
  </ProtectedRoute>
} />
```

### Expert-Only Route
```jsx
<Route path="/expert-dashboard" element={
  <ProtectedRoute allowedUserTypes={['expert']}>
    <ExpertDashboard />
  </ProtectedRoute>
} />
```

### Public Route (No Authentication Required)
```jsx
<Route path="/public" element={
  <NonAuthRoute>
    <PublicComponent />
  </NonAuthRoute>
} />
```

### Shopify-Integrated Route
```jsx
<Route path="/aicoach" element={
  <ShopifyAuthGuard>
    <ProtectedRoute>
      <AiCoach />
    </ProtectedRoute>
  </ShopifyAuthGuard>
} />
```

## Authentication Flow

### 1. User Access Attempt
1. User tries to access a protected route
2. AuthGuard checks authentication status
3. If not authenticated, redirects to login with redirect parameter

### 2. Login Process
1. User logs in on AuthPage
2. AuthContext updates with user information
3. AuthGuard detects authentication change
4. Redirects to intended destination or default dashboard

### 3. Shopify Integration
1. User clicks "Try Now" on Shopify frontend
2. Shopify generates Firebase ID token
3. Redirects to React app with token
4. ShopifyAuthGuard processes token
5. Checks user existence in Firestore
6. Redirects to auth or registration page
7. User completes authentication
8. Redirects to intended destination

## User Type System

### User Types
- `'user'`: Regular users (default)
- `'expert'`: Nutrition experts
- `'admin'`: System administrators

### Route Access Rules
- **Public Routes**: No authentication required
- **User Routes**: Requires authentication, any user type
- **Expert Routes**: Requires authentication, expert user type only
- **Admin Routes**: Requires authentication, admin user type only

## URL Parameters

### Redirect Parameter
- `?redirect=/intended/path`: Redirects to this path after login
- Automatically handled by AuthGuard
- Preserved across authentication flow

### Shopify Parameters
- `?token=firebase_id_token`: Shopify authentication token
- `?message=welcome_message`: Display message on auth page
- `?error=error_message`: Display error message

## Error Handling

### Authentication Errors
- Invalid credentials
- Network errors
- Firebase errors
- User type mismatches

### Token Errors
- Invalid token format
- Expired tokens
- Token verification failures
- User not found in Firestore

### Redirect Errors
- Invalid redirect paths
- Missing permissions
- Circular redirects

## Security Features

### Route Protection
- Prevents unauthorized access
- Validates user permissions
- Handles authentication state changes

### Token Security
- Client-side token decoding
- Firestore user verification
- Automatic token cleanup

### Session Management
- Centralized state management
- Automatic logout on errors
- Persistent authentication state

## Performance Optimizations

### Lazy Loading
- Components load only when needed
- Authentication checks are efficient
- Minimal re-renders

### Caching
- User type cached in context
- Authentication state persisted
- Firestore queries optimized

## Testing

### Test Cases
1. **Unauthenticated Access**: Should redirect to login
2. **Authenticated Access**: Should allow access
3. **User Type Validation**: Should enforce user type restrictions
4. **Redirect After Login**: Should redirect to intended destination
5. **Shopify Integration**: Should handle token authentication
6. **Error Handling**: Should handle various error scenarios

### Test Commands
```bash
# Run tests
npm test

# Run specific test file
npm test AuthGuard.test.js

# Run with coverage
npm test -- --coverage
```

## Troubleshooting

### Common Issues

1. **Infinite Redirects**
   - Check redirect parameter format
   - Verify route permissions
   - Check authentication state

2. **User Type Mismatch**
   - Verify user type in Firestore
   - Check allowedUserTypes array
   - Ensure proper user type assignment

3. **Token Processing Errors**
   - Check token format
   - Verify Firebase configuration
   - Check Firestore permissions

4. **Authentication State Issues**
   - Check AuthContext provider
   - Verify useAuth hook usage
   - Check Firebase auth state

### Debug Steps

1. Check browser console for errors
2. Verify authentication state in React DevTools
3. Check Firebase authentication status
4. Verify Firestore user data
5. Test with different user types
6. Check URL parameters

## Future Enhancements

### Planned Features
1. **Role-Based Permissions**: More granular permission system
2. **Session Timeout**: Automatic logout after inactivity
3. **Multi-Factor Authentication**: Enhanced security
4. **Audit Logging**: Track authentication events
5. **Advanced Token Handling**: Server-side token verification

### Performance Improvements
1. **Route Preloading**: Preload protected routes
2. **State Persistence**: Better state management
3. **Optimistic Updates**: Faster UI updates
4. **Background Sync**: Sync authentication state

## Configuration

### Environment Variables
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
```

### Firebase Rules
```javascript
// Firestore rules for user data
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Best Practices

### Component Usage
1. Always wrap protected routes with AuthGuard
2. Use appropriate user type restrictions
3. Handle loading states properly
4. Provide fallback UI for errors

### State Management
1. Use AuthContext for global state
2. Avoid direct Firebase auth calls
3. Handle authentication state changes
4. Clean up subscriptions properly

### Security
1. Validate all user inputs
2. Sanitize redirect parameters
3. Handle token expiration
4. Implement proper error boundaries

This authentication guard system provides a robust, secure, and user-friendly way to manage authentication and authorization in the React application.
