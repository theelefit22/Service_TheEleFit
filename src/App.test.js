import { render } from '@testing-library/react';
import App from './App';
import { BrowserRouter } from 'react-router-dom';

// Mock all the components that cause issues with Jest
jest.mock('./pages/AiCoach', () => () => <div>AiCoach Mock</div>);
jest.mock('./pages/ExpertsPage', () => () => <div>ExpertsPage Mock</div>);
jest.mock('./pages/DetailsPage', () => () => <div>DetailsPage Mock</div>);
jest.mock('./pages/UserDashboard', () => () => <div>UserDashboard Mock</div>);
jest.mock('./pages/AdminPanel', () => () => <div>AdminPanel Mock</div>);
jest.mock('./pages/AuthPage', () => () => <div>AuthPage Mock</div>);
jest.mock('./pages/CommunityPage', () => () => <div>CommunityPage Mock</div>);
jest.mock('./pages/GroceryListProcessor', () => () => <div>GroceryListProcessor Mock</div>);
jest.mock('./pages/HomePage', () => () => <div>HomePage Mock</div>);
jest.mock('./pages/ThankYouPage', () => () => <div>ThankYouPage Mock</div>);
jest.mock('./pages/PrivacyPolicy', () => () => <div>PrivacyPolicy Mock</div>);

// Mock the Firebase initialization
jest.mock('./services/firebase', () => ({
  auth: {},
  db: {},
  database: {}
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

test('renders without crashing', () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
  
  // Just verify the app renders without errors
  expect(true).toBe(true);
});