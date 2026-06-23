import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try {
      const stored = localStorage.getItem('satyascan-language');
      return stored || 'auto';
    } catch {
      return 'auto';
    }
  });

  const [detectedLanguage, setDetectedLanguage] = useState(null);

  // Save language preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('satyascan-language', selectedLanguage);
    } catch (e) {
      console.error('Failed to save language preference:', e);
    }
  }, [selectedLanguage]);

  const value = {
    selectedLanguage,
    setSelectedLanguage,
    detectedLanguage,
    setDetectedLanguage,
    isAutoDetect: selectedLanguage === 'auto',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
