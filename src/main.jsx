import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import ToastProvider from './components/ToastProvider.jsx';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2e7d32', // warm green
    },
    secondary: {
      main: '#a5d6a7', // lighter green accent
    },
    background: {
      default: '#fdfdfb',
      paper: '#ffffff',
    },
  },
  shape: {
    borderRadius: 10,
  },
});

const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PayPalScriptProvider options={{ clientId: paypalClientId, intent: 'subscription', vault: true }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <ToastProvider>
              <App />
            </ToastProvider>
          </ThemeProvider>
        </PayPalScriptProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
