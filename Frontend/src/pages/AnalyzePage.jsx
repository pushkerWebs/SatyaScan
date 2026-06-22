import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeText, analyzeUrl, analyzeImage } from '../api/api';
import LoadingState from '../components/LoadingState';

const TABS = ['text', 'url', 'image'];

// Advance a fake step counter to show realistic pipeline progress
function useFakeProgress(active) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) { setStep(0); return; }
    const intervals = [3000, 6000, 14000, 28000, 42000]; // ms into request
    const timers = intervals.map((delay, i) =>
      setTimeout(() => setStep(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [active]);
  return step;
}

export default function AnalyzePage() {
  const [tab, setTab] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const progressStep = useFakeProgress(loading);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate
    if (tab === 'text' && !textInput.trim()) return setError('Please enter some text.');
    if (tab === 'url' && !urlInput.trim()) return setError('Please enter a URL.');
    if (tab === 'image' && !imageFile) return setError('Please select an image file.');

    setLoading(true);
    try {
      let res;
      if (tab === 'text') res = await analyzeText(textInput);
      else if (tab === 'url') res = await analyzeUrl(urlInput);
      else res = await analyzeImage(imageFile);

      // Navigate to results, passing data via location state
      navigate('/results', { state: { result: res.data } });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Analysis failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState currentStep={progressStep} />;

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Analyze Content</h1>
        <p className="text-gray-400 mb-8">Choose an input method and submit — we'll fact-check it in seconds.</p>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 mb-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`px-5 py-2 text-sm font-medium capitalize transition border-b-2 -mb-px
                ${tab === t
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              {t === 'text' ? '📝 Text' : t === 'url' ? '🔗 URL' : '🖼️ Image'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Text */}
          {tab === 'text' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Paste article or claim text</label>
              <textarea
                rows={8}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste news article, social media post, or any factual claim here…"
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 resize-none text-sm"
              />
              <p className="text-gray-600 text-xs mt-1">{textInput.length} characters</p>
            </div>
          )}

          {/* URL */}
          {tab === 'url' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Article URL</label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 text-sm"
              />
              <p className="text-gray-500 text-xs mt-1">
                The backend will scrape the article text using Puppeteer/Cheerio.
              </p>
            </div>
          )}

          {/* Image */}
          {tab === 'image' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Upload image with text (screenshot, photo, etc.)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-lg p-8 text-center cursor-pointer transition"
              >
                {imageFile ? (
                  <div className="text-green-400 text-sm">
                    ✓ {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    Click to choose file or drag &amp; drop<br />
                    <span className="text-xs text-gray-600">PNG, JPG, WEBP (max 10 MB)</span>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setImageFile(e.target.files[0] || null)}
              />
              {imageFile && (
                <button
                  type="button"
                  onClick={() => setImageFile(null)}
                  className="text-xs text-red-400 hover:underline mt-1"
                >
                  Remove
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-900/40 border border-red-600 text-red-300 rounded p-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
          >
            Analyze →
          </button>
        </form>

        <p className="text-gray-600 text-xs mt-4 text-center">
          Analysis is free without login. Login to save history.
        </p>
      </div>
    </div>
  );
}
