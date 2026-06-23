import { useLanguage } from '../context/LanguageContext';
import languages from '../constants/languages.json';

export default function LanguageSelector() {
  const { selectedLanguage, setSelectedLanguage, detectedLanguage } = useLanguage();

  const handleLanguageChange = (newLanguage) => {
    setSelectedLanguage(newLanguage);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Language Dropdown */}
      <select
        value={selectedLanguage}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className="bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-colors"
        aria-label="Select language"
      >
        {Object.entries(languages).map(([code, lang]) => (
          <option key={code} value={code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>

      {/* Detection indicator */}
      {selectedLanguage === 'auto' && detectedLanguage && (
        <span className="text-xs text-gray-500 ml-2">
          Detected: {languages[detectedLanguage]?.flag || '🌐'} {languages[detectedLanguage]?.name || 'Unknown'}
        </span>
      )}
    </div>
  );
}
