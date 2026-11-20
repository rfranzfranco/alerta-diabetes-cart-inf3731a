/**
 * VIEWMODEL: useThemeViewModel.js
 * Gestion de tema (claro / oscuro) en DaisyUI con persistencia.
 */

import { useState, useEffect } from 'react';

export function useThemeViewModel() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('app-daisy-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-daisy-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme
  };
}
