import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

const SessionTransferTest = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, userType, isLoading, user } = useAuthContext();
  const [testResults, setTestResults] = useState([]);

  const addTestResult = (test, status, message) => {
    setTestResults(prev => [...prev, { test, status, message, timestamp: new Date().toLocaleTimeString() }]);
  };

  // Test 1: Check current URL and redirect parameters
  const testRedirectParams = () => {
    const urlParams = new URLSearchParams(location.search);
    const redirect = urlParams.get('redirect');
    const message = urlParams.get('message');
    const error = urlParams.get('error');
    
    if (redirect) {
      addTestResult('Redirect Parameter', '✅ PASS', `Found redirect: ${decodeURIComponent(redirect)}`);
    } else {
      addTestResult('Redirect Parameter', '❌ FAIL', 'No redirect parameter found');
    }
    
    if (message) {
      addTestResult('Message Parameter', '✅ PASS', `Found message: ${message}`);
    }
    
    if (error) {
      addTestResult('Error Parameter', '⚠️ WARN', `Found error: ${error}`);
    }
  };

  // Test 2: Check authentication state
  const testAuthState = () => {
    if (isLoading) {
      addTestResult('Authentication State', '⏳ LOADING', 'Authentication state is loading...');
    } else if (isAuthenticated) {
      addTestResult('Authentication State', '✅ AUTHENTICATED', `User: ${user?.email}, Type: ${userType}`);
    } else {
      addTestResult('Authentication State', '❌ NOT AUTHENTICATED', 'User is not logged in');
    }
  };

  // Test 3: Check localStorage for Shopify data
  const testShopifyData = () => {
    const shopifyEmail = localStorage.getItem('shopify_email');
    const shopifyUid = localStorage.getItem('shopify_uid');
    
    if (shopifyEmail) {
      addTestResult('Shopify Data', '✅ FOUND', `Email: ${shopifyEmail}, UID: ${shopifyUid || 'None'}`);
    } else {
      addTestResult('Shopify Data', 'ℹ️ NONE', 'No Shopify data in localStorage');
    }
  };

  // Test 4: Test navigation to protected routes
  const testProtectedRouteNavigation = (route) => {
    addTestResult(`Navigation to ${route}`, '🔄 TESTING', `Attempting to navigate to ${route}...`);
    navigate(route);
  };

  // Test 5: Simulate Shopify token flow
  const testShopifyTokenFlow = () => {
    const mockToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZ2V0Zml0LXdpdGgtZWxlZml0IiwiYXVkIjoiZ2V0Zml0LXdpdGgtZWxlZml0IiwiYXV0aF90aW1lIjoxNzM0NzI4MDAwLCJ1c2VyX2lkIjoiVGVzdFVzZXIxMjM0NTY3ODkwIiwic3ViIjoiVGVzdFVzZXIxMjM0NTY3ODkwIiwiYWRtaW4iOmZhbHNlLCJpYXQiOjE3MzQ3MjgwMDAsImV4cCI6MTczNDczMTYwMCwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbInRlc3RAZXhhbXBsZS5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.mock_signature';
    
    addTestResult('Shopify Token Flow', '🔄 TESTING', 'Simulating Shopify token redirect...');
    window.location.href = `/aicoach?token=${mockToken}`;
  };

  // Test 6: Test session transfer flow from ai-coach-hero-main
  const testSessionTransferFlow = () => {
    const testEmail = 'test@example.com';
    const testCustomerId = 'gid://shopify/Customer/1234567890';
    
    addTestResult('Session Transfer Flow', '🔄 TESTING', 'Simulating session transfer from ai-coach-hero-main...');
    
    // Simulate session transfer URL
    const sessionTransferUrl = `/aicoach?email=${encodeURIComponent(testEmail)}&customerId=${encodeURIComponent(testCustomerId)}&sessionTransfer=true`;
    
    addTestResult('Session Transfer URL', '✅ GENERATED', `URL: ${sessionTransferUrl}`);
    
    // Test URL parameter parsing
    const urlParams = new URLSearchParams(sessionTransferUrl.split('?')[1]);
    const email = urlParams.get('email');
    const customerId = urlParams.get('customerId');
    const sessionTransfer = urlParams.get('sessionTransfer');
    
    if (email === testEmail && customerId === testCustomerId && sessionTransfer === 'true') {
      addTestResult('URL Parameter Parsing', '✅ PASS', 'All parameters parsed correctly');
    } else {
      addTestResult('URL Parameter Parsing', '❌ FAIL', 'Parameter parsing failed');
    }
    
    // Navigate to test the actual flow
    window.location.href = sessionTransferUrl;
  };

  // Run all tests
  const runAllTests = () => {
    setTestResults([]);
    addTestResult('Test Suite', '🚀 STARTING', 'Running all session transfer tests...');
    
    testRedirectParams();
    testAuthState();
    testShopifyData();
    
    addTestResult('Test Suite', '✅ COMPLETE', 'All tests completed');
  };

  // Run tests on component mount
  useEffect(() => {
    runAllTests();
  }, [location, isAuthenticated, userType, isLoading]);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🧪 Session Transfer Test Suite</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Current State</h2>
        <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '10px' }}>
          <p><strong>Current URL:</strong> {window.location.href}</p>
          <p><strong>Path:</strong> {location.pathname}</p>
          <p><strong>Search:</strong> {location.search}</p>
          <p><strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
          <p><strong>User Type:</strong> {userType || 'None'}</p>
          <p><strong>Is Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Test Controls</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={runAllTests}
            style={{ padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            🔄 Run All Tests
          </button>
          <button 
            onClick={() => testProtectedRouteNavigation('/aicoach')}
            style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            🎯 Test /aicoach
          </button>
          <button 
            onClick={() => testProtectedRouteNavigation('/community')}
            style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            👥 Test /community
          </button>
          <button 
            onClick={() => testProtectedRouteNavigation('/test-redirect')}
            style={{ padding: '10px 15px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            🧪 Test /test-redirect
          </button>
          <button 
            onClick={testShopifyTokenFlow}
            style={{ padding: '10px 15px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '5px' }}
          >
            🛒 Test Shopify Token
          </button>
          <button 
            onClick={testSessionTransferFlow}
            style={{ padding: '10px 15px', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            🔄 Test Session Transfer
          </button>
        </div>
      </div>

      <div>
        <h2>Test Results</h2>
        <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '5px' }}>
          {testResults.length === 0 ? (
            <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No test results yet. Click "Run All Tests" to start.</p>
          ) : (
            testResults.map((result, index) => (
              <div 
                key={index} 
                style={{ 
                  padding: '10px', 
                  borderBottom: '1px solid #eee',
                  backgroundColor: result.status.includes('✅') ? '#d4edda' : 
                                 result.status.includes('❌') ? '#f8d7da' : 
                                 result.status.includes('⚠️') ? '#fff3cd' : '#f8f9fa'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>{result.test}</strong></span>
                  <span style={{ fontSize: '0.9em', color: '#666' }}>{result.timestamp}</span>
                </div>
                <div style={{ marginTop: '5px' }}>
                  <span style={{ fontWeight: 'bold' }}>{result.status}</span> {result.message}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '5px' }}>
        <h3>📋 Test Instructions</h3>
        <ol>
          <li><strong>Test Direct Navigation:</strong> Click "Test /aicoach" while logged out - should redirect to auth with redirect parameter</li>
          <li><strong>Test Login Redirect:</strong> Log in and verify you're redirected back to the intended page</li>
          <li><strong>Test Shopify Flow:</strong> Click "Test Shopify Token" to simulate the complete Shopify integration</li>
          <li><strong>Check Results:</strong> Review the test results above to see what's working and what needs fixing</li>
        </ol>
      </div>
    </div>
  );
};

export default SessionTransferTest;
