import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import ExpertsPage from './pages/ExpertsPage';
import ExpertDetailPage from './pages/ExpertDetailPage';
import RegistrationPage from './pages/RegistrationPage';
import AuthPage from './pages/AuthPage';
import ExpertProfileSetup from './pages/ExpertProfileSetup';
import ExpertDashboard from './pages/ExpertDashboard';
import UserDashboard from './pages/UserDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import ExpertApplicationForm from './pages/ExpertApplicationForm';
import GoogleAuthCallback from './pages/GoogleAuthCallback';
import PrivacyPolicy from './pages/PrivacyPolicy';
import NotFoundPage from './pages/NotFoundPage';
import CommunityPage from './pages/CommunityPage';
import ContactPage from './pages/ContactPage';
import LoadingSpinner from './components/LoadingSpinner';
import GroceryListProcessor from './pages/GroceryListProcessor';
import TokenLogin from './components/TokenLogin';
import AuthGuard from './components/AuthGuard';
import ShopifyAuthGuard from './components/ShopifyAuthGuard';
import { AuthProvider } from './contexts/AuthContext';
import TestRedirect from './components/TestRedirect';
import DebugRedirect from './components/DebugRedirect';
import SessionTransferTest from './components/SessionTransferTest';
import { seedExpertsData } from './services/seedData';
import { auth, getUserType } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import './App.css';
import AiCoach from './pages/AiCoach';
import AiFitnessCoach from './pages/AiFitnessCoach';
import CustomerAuth from './pages/CustomerAuth';
import ThankYouPage from './pages/ThankYouPage';
import DetailsPage from './pages/DetailsPage';

// ScrollToTop component to reset scroll on navigation
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// ProtectedRoute component using AuthGuard
const ProtectedRoute = ({ children, allowedUserTypes = null }) => {
  return (
    <AuthGuard requireAuth={true} allowedUserTypes={allowedUserTypes}>
      {children}
    </AuthGuard>
  );
};

// AdminProtectedRoute component specifically for admin routes
const AdminProtectedRoute = ({ children }) => {
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    setAdminChecked(true);
  }, []);

  if (!adminChecked) {
    return <LoadingSpinner text="loading..." />;
  }

  const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';

  if (!isAdminAuthenticated) {
    return <Navigate to="/admin" />;
  }

  return children;
};

// NonAuthRoute component using AuthGuard
const NonAuthRoute = ({ children }) => {
  return (
    <AuthGuard requireAuth={false}>
      {children}
    </AuthGuard>
  );
};

// EVA Customer Route Guard
const EvaCustomerRoute = ({ children }) => {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [isEvaCustomer, setIsEvaCustomer] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await import('./services/firebase').then(m => m.db).then(db => import('firebase/firestore').then(firestore => firestore.getDoc(firestore.doc(db, 'users', currentUser.uid))));
          if (userDoc && userDoc.exists && userDoc.exists()) {
            const isEva = userDoc.data().isEvaCustomer || false;
            setIsEvaCustomer(isEva);
            console.log('🔍 EvaCustomerRoute: User authenticated, isEvaCustomer:', isEva);
          } else {
            setIsEvaCustomer(false);
            console.log('🔍 EvaCustomerRoute: User authenticated, no user doc found, isEvaCustomer: false');
          }
        } catch (error) {
          setIsEvaCustomer(false);
          console.log('🔍 EvaCustomerRoute: Error checking user doc, isEvaCustomer: false');
        }
      } else {
        setIsEvaCustomer(false);
        console.log('🔍 EvaCustomerRoute: User not authenticated, isEvaCustomer: false');
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, [location.pathname]);

  if (!authChecked) {
    return <LoadingSpinner text="Loading..." />;
  }

  // If EVA customer and not on allowed pages, redirect to home
  // Only restrict EVA customers, allow all other users to access all routes
  console.log('🔍 EvaCustomerRoute: Current path:', location.pathname, 'isEvaCustomer:', isEvaCustomer);

  if (isEvaCustomer && !['/', '/HomePage', '/grocery-list'].includes(location.pathname)) {
    console.log('🔄 EvaCustomerRoute: EVA customer trying to access restricted route:', location.pathname);
    return <Navigate to="/" replace />;
  }

  console.log('✅ EvaCustomerRoute: Allowing access to route:', location.pathname);

  return children;
};

function App() {
  useEffect(() => {
    seedExpertsData().catch(console.error);
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <ScrollToTop />
          <Navbar />
          <div className="content">
            <EvaCustomerRoute>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/HomePage" element={<HomePage />} />
                <Route path="/community" element={
                  <ProtectedRoute>
                    <CommunityPage />
                  </ProtectedRoute>
                } />
                <Route path="/aicoach" element={
                  <ProtectedRoute>
                    <AiCoach />
                  </ProtectedRoute>
                } />
                <Route path="/ai-fitness-coach" element={<AiFitnessCoach />} />
                <Route path="/grocery-list" element={
                  <ProtectedRoute>
                    <GroceryListProcessor />
                  </ProtectedRoute>
                } />
                <Route path="/thank-you" element={
                  <ProtectedRoute>
                    <ThankYouPage />
                  </ProtectedRoute>
                } />
                <Route path="/details" element={
                  <ProtectedRoute>
                    <DetailsPage />
                  </ProtectedRoute>
                } />
                <Route path="/experts" element={<ExpertsPage />} />
                <Route path="/expert/:id" element={<ExpertDetailPage />} />
                <Route path="/register" element={<RegistrationPage />} />
                <Route path="/auth" element={
                  <NonAuthRoute>
                    <AuthPage />
                  </NonAuthRoute>
                } />
                <Route path="/auth/token" element={<TokenLogin />} />
                <Route path="/auth/customer" element={<CustomerAuth />} />
                <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
                <Route path="/expert-profile-setup" element={<ExpertProfileSetup />} />
                <Route path="/expert-dashboard" element={
                  <ProtectedRoute allowedUserTypes={['expert']}>
                    <ExpertDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/user-dashboard" element={
                  <ProtectedRoute>
                    <UserDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/apply-as-expert" element={<ExpertApplicationForm />} />
                <Route path="/admin" element={<AdminLogin />} />
                <Route path="/admin/panel" element={
                  <AdminProtectedRoute>
                    <AdminPanel />
                  </AdminProtectedRoute>
                } />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/test-redirect" element={
                  <ProtectedRoute>
                    <TestRedirect />
                  </ProtectedRoute>
                } />
                <Route path="/debug" element={<DebugRedirect />} />
                <Route path="/session-test" element={<SessionTransferTest />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </EvaCustomerRoute>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
