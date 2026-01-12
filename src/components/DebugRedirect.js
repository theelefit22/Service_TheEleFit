import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

const DebugRedirect = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, userType, isLoading } = useAuthContext();

  useEffect(() => {
    console.log('🐛 DebugRedirect: Component mounted');
    console.log('🐛 DebugRedirect: Current path:', location.pathname);
    console.log('🐛 DebugRedirect: Search params:', location.search);
    console.log('🐛 DebugRedirect: Is authenticated:', isAuthenticated);
    console.log('🐛 DebugRedirect: User type:', userType);
    console.log('🐛 DebugRedirect: Is loading:', isLoading);
  }, [location, isAuthenticated, userType, isLoading]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', margin: '20px' }}>
      <h2>🐛 Debug Redirect Component</h2>
      <div style={{ marginBottom: '10px' }}>
        <strong>Current Path:</strong> {location.pathname}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>Search Params:</strong> {location.search}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>User Type:</strong> {userType || 'None'}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>Is Loading:</strong> {isLoading ? 'Yes' : 'No'}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>Full URL:</strong> {window.location.href}
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Test Links:</h3>
        <button 
          onClick={() => navigate('/aicoach')}
          style={{ margin: '5px', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Go to /aicoach
        </button>
        <button 
          onClick={() => navigate('/test-redirect')}
          style={{ margin: '5px', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Go to /test-redirect
        </button>
        <button 
          onClick={() => navigate('/auth')}
          style={{ margin: '5px', padding: '10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '5px' }}
        >
          Go to /auth
        </button>
      </div>
    </div>
  );
};

export default DebugRedirect;
