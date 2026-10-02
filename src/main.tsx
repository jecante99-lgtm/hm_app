import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './lib/auth';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><ErrorBoundary><AuthProvider><App /></AuthProvider></ErrorBoundary></BrowserRouter></StrictMode>,
);
