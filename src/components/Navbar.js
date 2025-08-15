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

const Navbar = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEvaCustomer, setIsEvaCustomer] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const type = await getUserType(user.uid);
          setUserType(type);
          
          // Get user data to check if they are an EVA customer
          const userDoc = await getDoc(doc(db, 'users', user.uid));
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
          setUserType(null);
          setIsEvaCustomer(false);
        }
      } else {
        setCurrentUser(null);
        setUserType(null);
        setIsEvaCustomer(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [location.pathname, navigate]);

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
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  // If user is Eva customer, show simplified navbar
  if (currentUser && isEvaCustomer) {
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
              to={currentUser ? "/aicoach" : "/auth"}
              className={({isActive}) => isActive ? "nav-link active" : "nav-link"}
              onClick={() => setMenuOpen(false)}
            >
              AI Coach
            </NavLink>
          </li>

          {!loading && (
            <>
              {currentUser ? (
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
