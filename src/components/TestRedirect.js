import React from 'react';
import { useLocation } from 'react-router-dom';

const TestRedirect = () => {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const redirectPath = urlParams.get('redirect');

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', margin: '20px' }}>
      <h2>Test Redirect Component</h2>
      <p><strong>Current Path:</strong> {location.pathname}</p>
      <p><strong>Redirect Parameter:</strong> {redirectPath || 'None'}</p>
      <p><strong>Full URL:</strong> {window.location.href}</p>
    </div>
  );
};

export default TestRedirect;
