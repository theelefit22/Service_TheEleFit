// Test script for Shopify to React session transfer
// Run this in browser console to test the flow

console.log('🧪 Starting Shopify to React Session Transfer Test');

// Test 1: Direct navigation to /aicoach (should redirect to auth with redirect param)
function testDirectNavigation() {
  console.log('📋 Test 1: Direct navigation to /aicoach');
  console.log('Expected: Redirect to /auth?redirect=%2Faicoach');
  
  // Navigate to /aicoach
  window.location.href = '/aicoach';
}

// Test 2: Simulate Shopify token redirect
function testShopifyTokenRedirect() {
  console.log('📋 Test 2: Simulate Shopify token redirect');
  
  // Create a mock Firebase ID token (this won't work for real auth, but tests the flow)
  const mockToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZ2V0Zml0LXdpdGgtZWxlZml0IiwiYXVkIjoiZ2V0Zml0LXdpdGgtZWxlZml0IiwiYXV0aF90aW1lIjoxNzM0NzI4MDAwLCJ1c2VyX2lkIjoiVGVzdFVzZXIxMjM0NTY3ODkwIiwic3ViIjoiVGVzdFVzZXIxMjM0NTY3ODkwIiwiYWRtaW4iOmZhbHNlLCJpYXQiOjE3MzQ3MjgwMDAsImV4cCI6MTczNDczMTYwMCwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbInRlc3RAZXhhbXBsZS5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.mock_signature';
  
  // Navigate with token
  window.location.href = `/aicoach?token=${mockToken}`;
}

// Test 3: Check current authentication state
function checkAuthState() {
  console.log('📋 Test 3: Check current authentication state');
  
  // Check if user is authenticated
  const isAuthenticated = !!window.firebase?.auth?.currentUser;
  console.log('Is authenticated:', isAuthenticated);
  
  if (isAuthenticated) {
    console.log('User:', window.firebase?.auth?.currentUser?.email);
  }
  
  // Check localStorage for Shopify data
  const shopifyEmail = localStorage.getItem('shopify_email');
  const shopifyUid = localStorage.getItem('shopify_uid');
  console.log('Shopify email:', shopifyEmail);
  console.log('Shopify UID:', shopifyUid);
}

// Test 4: Test redirect parameter handling
function testRedirectParameter() {
  console.log('📋 Test 4: Test redirect parameter handling');
  
  const urlParams = new URLSearchParams(window.location.search);
  const redirect = urlParams.get('redirect');
  console.log('Current redirect parameter:', redirect);
  
  if (redirect) {
    console.log('Decoded redirect:', decodeURIComponent(redirect));
  }
}

// Test 5: Simulate login and check redirect
function testLoginRedirect() {
  console.log('📋 Test 5: Simulate login and check redirect');
  
  // Check if we're on auth page with redirect
  if (window.location.pathname === '/auth') {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    
    if (redirect) {
      console.log('✅ Auth page has redirect parameter:', redirect);
      console.log('After login, should redirect to:', decodeURIComponent(redirect));
    } else {
      console.log('❌ Auth page missing redirect parameter');
    }
  } else {
    console.log('Not on auth page, current path:', window.location.pathname);
  }
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running all session transfer tests...');
  
  testRedirectParameter();
  checkAuthState();
  testLoginRedirect();
  
  console.log('✅ Tests completed. Check the results above.');
}

// Export functions for manual testing
window.testSessionTransfer = {
  testDirectNavigation,
  testShopifyTokenRedirect,
  checkAuthState,
  testRedirectParameter,
  testLoginRedirect,
  runAllTests
};

console.log('🧪 Test functions available:');
console.log('- testSessionTransfer.testDirectNavigation()');
console.log('- testSessionTransfer.testShopifyTokenRedirect()');
console.log('- testSessionTransfer.checkAuthState()');
console.log('- testSessionTransfer.testRedirectParameter()');
console.log('- testSessionTransfer.testLoginRedirect()');
console.log('- testSessionTransfer.runAllTests()');
