import { useEffect, useState } from 'react';
import { api } from '../services/api';

export type AuthPageSettings = {
  brandName: string;
  loginHeroImage: string;
  registerHeroImage: string;
  forgotPasswordHeroImage: string;
  resetPasswordHeroImage: string;
  changePasswordHeroImage: string;
  loginHeroCaption: string;
  registerHeroCaption: string;
  forgotPasswordHeroCaption: string;
  resetPasswordHeroCaption: string;
  changePasswordHeroCaption: string;
  loginTitle: string;
  loginSubtitle: string;
  registerTitle: string;
  registerSubtitle: string;
  forgotPasswordTitle: string;
  forgotPasswordSubtitle: string;
  resetPasswordTitle: string;
  resetPasswordSubtitle: string;
  changePasswordTitle: string;
  changePasswordSubtitle: string;
  loginSubmitLabel: string;
  registerSubmitLabel: string;
  forgotPasswordSubmitLabel: string;
  resetPasswordSubmitLabel: string;
  changePasswordSubmitLabel: string;
  googleClientIds: string;
  showGoogleOnLogin: boolean;
  showGoogleOnRegister: boolean;
};

export const AUTH_PAGE_SETTINGS_DEFAULTS: AuthPageSettings = {
  brandName: 'ZuriKaribu',
  loginHeroImage:
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  registerHeroImage:
    'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1200&q=80',
  forgotPasswordHeroImage:
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  resetPasswordHeroImage:
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  changePasswordHeroImage:
    'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1200&q=80',
  loginHeroCaption: 'Wear the Story of Africa',
  registerHeroCaption: 'Wear the Story of Africa',
  forgotPasswordHeroCaption: 'Secure your African fashion account',
  resetPasswordHeroCaption: 'Set a stronger password to secure your account',
  changePasswordHeroCaption: 'Update your temporary password to continue',
  loginTitle: 'Welcome Back',
  loginSubtitle: 'Sign in to continue your African fashion journey',
  registerTitle: 'Create Account',
  registerSubtitle: 'Join African fashion marketplace',
  forgotPasswordTitle: 'Forgot Password',
  forgotPasswordSubtitle: 'Enter your email to receive a secure reset link.',
  resetPasswordTitle: 'Reset Password',
  resetPasswordSubtitle: 'Set a new password for your account.',
  changePasswordTitle: 'Change Temporary Password',
  changePasswordSubtitle: 'Set a secure password before continuing.',
  loginSubmitLabel: 'Sign In',
  registerSubmitLabel: 'Create Account',
  forgotPasswordSubmitLabel: 'Send Reset Link',
  resetPasswordSubmitLabel: 'Reset Password',
  changePasswordSubmitLabel: 'Update Password',
  googleClientIds: '',
  showGoogleOnLogin: true,
  showGoogleOnRegister: true,
};

export function useAuthPageSettings() {
  const [settings, setSettings] = useState<AuthPageSettings>(AUTH_PAGE_SETTINGS_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const response = await api.homepageSections.getAuthPageSettings();
        if (!mounted || !response?.success || !response?.data) return;
        setSettings((prev) => ({
          ...prev,
          ...response.data,
        }));
      } catch (error) {
        console.error('Failed to load auth page settings:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  return { settings, loading };
}
