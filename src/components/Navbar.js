import React, { useState, useEffect, useRef } from 'react';
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
  const menuRef = useRef(null);
  const toggleRef = useRef(null);

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

  // Handle window resize to close menu on larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        // Close mobile menu when screen becomes larger
        setMenuOpen(false);
        document.body.classList.remove('menu-open');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && menuRef.current && toggleRef.current) {
        if (!menuRef.current.contains(event.target) && !toggleRef.current.contains(event.target)) {
          closeMenu();
        }
      }
    };

    const handleEscKey = (event) => {
      if (event.keyCode === 27 && menuOpen) {
        closeMenu();
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [menuOpen]);

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
    // Close menu when route changes
    setMenuOpen(false);
    document.body.classList.remove('menu-open');
  }, [location.pathname]);

  useEffect(() => {
    // Handle body overflow when menu is open
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
    console.log('Toggling menu. Current state:', menuOpen);
    setMenuOpen(prevState => {
      const newState = !prevState;
      console.log('New state will be:', newState);
      return newState;
    });
  };

  const closeMenu = () => {
    console.log('Closing menu');
    setMenuOpen(false);
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
          ref={toggleRef}
          className={`mobile-menu-toggle ${menuOpen ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMenu();
          }}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
       
        <ul 
          ref={menuRef}
          className={`nav-menu ${menuOpen ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            // Don't close menu when clicking on it, only when clicking menu items
          }}
        >
          <li className="nav-item">
            <NavLink 
              to="/" 
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
              onClick={closeMenu}
            >
              Home
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink 
              to="/community" 
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
              onClick={closeMenu}
            >
              Community
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink 
              to="/experts" 
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
              onClick={closeMenu}
            >
              Find Expert
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink 
              to="/apply-as-expert" 
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
              onClick={closeMenu}
            >
              Apply as Expert
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to={isAuthenticated ? "/aicoach" : "/auth"}
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"}
              onClick={closeMenu}
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
                        onClick={closeMenu}
                      >
                        Dashboard
                      </NavLink>
                    ) : (
                      <NavLink 
                        to="/user-dashboard" 
                        className={({isActive}) => isActive ? "nav-link active" : "nav-link"} 
                        onClick={closeMenu}
                      >
                        My Dashboard
                      </NavLink>
                    )}
                  </li>

                  <li className="nav-item">
                    <button onClick={(e) => {
                      e.stopPropagation();
                      handleLogout();
                      closeMenu();
                    }} className="nav-button">
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                <li className="nav-item">
                  <Link to="/auth" className="nav-link-button" onClick={closeMenu}>
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