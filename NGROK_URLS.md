# Ngrok URLs for Testing

## Current URLs

### React App (Service_TheEleFit-4)
- **URL**: `https://f21aa26bd4cd.ngrok-free.app`
- **Test Routes**:
  - Main app: `https://f21aa26bd4cd.ngrok-free.app`
  - AI Coach: `https://f21aa26bd4cd.ngrok-free.app/aicoach`
  - Session Test: `https://f21aa26bd4cd.ngrok-free.app/session-test`
  - Debug: `https://f21aa26bd4cd.ngrok-free.app/debug`

### Shopify Frontend (ai-coach-hero-main)
- **URL**: `https://dec21b6e1071.ngrok-free.app`
- **Features**:
  - Try Now button redirects to React app
  - Firebase authentication
  - Token generation

## Testing Flow

1. **Start with Shopify Frontend**:
   - Go to: `https://dec21b6e1071.ngrok-free.app`
   - Click "Try Now" button
   - Should redirect to: `https://f21aa26bd4cd.ngrok-free.app/aicoach?token={FIREBASE_ID_TOKEN}`

2. **React App Processing**:
   - Token is processed in AiCoach component
   - User is redirected to auth page with redirect parameter
   - After login, user is redirected back to /aicoach

3. **Test Session Transfer**:
   - Go to: `https://f21aa26bd4cd.ngrok-free.app/session-test`
   - Use test buttons to verify each step
   - Check console logs for debugging

## Important Notes

- Both apps must be running for the flow to work
- Firebase configuration is shared between both apps
- Tokens are passed via URL parameters
- Redirect parameters preserve intended destination

## Troubleshooting

If the flow doesn't work:
1. Check that both ngrok tunnels are active
2. Verify Firebase configuration in both apps
3. Check browser console for errors
4. Use the debug components to trace the flow
