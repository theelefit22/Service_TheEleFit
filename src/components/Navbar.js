import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { auth, getUserType } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { IoNotificationsOutline } from 'react-icons/io5';
import { BsChatDots } from 'react-icons/bs';
import { HiOutlineUserGroup } from 'react-icons/hi';
import './Navbar.css';
import { db } from '../services/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { useAuthContext } from '../contexts/AuthContext';

const Navbar = () => {
  // Use AuthContext instead of local state
  const { user: currentUser, userType, isLoading: loading, isAuthenticated, logout } = useAuthContext();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEvaCustomer, setIsEvaCustomer] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Debug logging
  console.log('🔍 Navbar Debug - AuthContext state:', {
    isAuthenticated,
    currentUser: currentUser ? { email: currentUser.email, uid: currentUser.uid } : null,
    userType,
    loading
  });

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check for EVA customer status when user changes
  useEffect(() => {
    const checkEvaCustomer = async () => {
      if (currentUser && currentUser.uid) {
        try {
          // Get user data to check if they are an EVA customer
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const isEva = userDoc.data().isEvaCustomer || false;
            setIsEvaCustomer(isEva);
            // Redirect Eva users to grocery list if they're on a different page
            if (isEva && location.pathname !== '/grocery-list' && location.pathname !== '/auth') {
              navigate('/grocery-list');
            }
          }
        } catch (error) {
          console.error("Error getting user data:", error);
          setIsEvaCustomer(false);
        }
      } else {
        setIsEvaCustomer(false);
      }
    };

    checkEvaCustomer();
  }, [currentUser, location.pathname, navigate]);

  useEffect(() => {
    setMenuOpen(false);
    document.body.classList.remove('menu-open');
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : 'auto';
    if (menuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
    
    return () => {
      document.body.style.overflow = 'auto';
      document.body.classList.remove('menu-open');
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      // Clear verified customer session
      localStorage.removeItem('verifiedCustomerSession');
      
      // Use the logout function from AuthContext
      const result = await logout();
      
      if (result.success) {
        console.log('Logout successful');
        navigate('/');
      } else {
        console.error('Logout failed:', result.error);
        // Fallback to direct signOut if context logout fails
        if (auth.currentUser) {
          await signOut(auth);
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Error signing out:', error);
      // Fallback to direct signOut if context logout fails
      if (auth.currentUser) {
        await signOut(auth);
        navigate('/');
      }
    }
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  // If user is Eva customer, show simplified navbar
  if (isAuthenticated && currentUser && isEvaCustomer) {
    return (
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-container">
          <Link to="/grocery-list" className="navbar-logo">
            <img 
              src="https://theelefit.com/cdn/shop/files/freepik_br_3e6ca94d-018d-4329-8cd3-828c77c68075_1.svg?v=1737707946&width=700" 
              alt="The Elefit Logo" 
              className="logo-image"
            />
          </Link>
          
          <ul className="nav-menu">
            <li className="nav-item">
              <NavLink
                to="/grocery-list"
                className={({isActive}) => isActive ? "nav-link active" : "nav-link"}
              >
                Grocery List
              </NavLink>
            </li>
            <li className="nav-item">
              <button onClick={handleLogout} className="nav-button">
                Logout
              </button>
            </li>
          </ul>
        </div>
      </nav>
    );
  }

  // Regular navbar for non-Eva users
  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <img 
            src="https://theelefit.com/cdn/shop/files/freepik_br_3e6ca94d-018d-4329-8cd3-828c77c68075_1.svg?v=1737707946&width=700" 
            alt="The Elefit Logo" 
            className="logo-image"
          />
        </Link>
        
        <button 
          className={`mobile-menu-toggle ${menuOpen ? 'open' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
       
        <ul className={`nav-menu ${menuOpen ? 'active' : ''}`}>
          <li className="nav-item">
            <NavLink 
              to="/" 
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
              onClick={() => setMenuOpen(false)}
            >
              Home
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink 
              to="/community" 
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
              onClick={() => setMenuOpen(false)}
            >
              Community
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink 
              to="/experts" 
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
              onClick={() => setMenuOpen(false)}
            >
              Find Expert
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink 
              to="/apply-as-expert" 
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
              onClick={() => setMenuOpen(false)}
            >
              Apply as Expert
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to={isAuthenticated ? "/aicoach" : "/auth"}
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"}
              onClick={() => setMenuOpen(false)}
            >
              AI Coach
            </NavLink>
          </li>

          {!loading && (
            <>
              {isAuthenticated && currentUser ? (
                <>
                  <li className="nav-item">
                    {userType === 'expert' ? (
                      <NavLink 
                        to="/expert-dashboard" 
                        className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
                        onClick={() => setMenuOpen(false)}
                      >
                        Dashboard
                      </NavLink>
                    ) : (
                      <NavLink 
                        to="/user-dashboard" 
                        className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
                        onClick={() => setMenuOpen(false)}
                      >
                        My Dashboard
                      </NavLink>
                    )}
                  </li>

                  <li className="nav-item">
                    <button onClick={handleLogout} className="nav-button">
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                <li className="nav-item">
                  <Link to="/auth" className="nav-link-button" onClick={() => setMenuOpen(false)}>
                    Login / Register
                  </Link>
                </li>
              )}
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
