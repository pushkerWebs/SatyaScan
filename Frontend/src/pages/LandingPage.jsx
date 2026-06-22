import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-extrabold mb-4 tracking-tight">
          🔍 SatyaScan
        </h1>
        <p className="text-xl text-gray-400 mb-2">
          AI-powered fact-checking &amp; misinformation detector
        </p>
        <p className="text-gray-500 mb-8">
          Paste text, provide a URL, or upload an image. We'll extract claims,
          verify them against reliable sources, detect AI-generated content, and
          give you a Trust Score in seconds.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            to="/analyze"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            Start Analyzing →
          </Link>
          <Link
            to="/signup"
            className="border border-gray-600 hover:border-gray-400 text-gray-300 font-semibold px-6 py-3 rounded-lg transition"
          >
            Create Free Account
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {[
            { icon: '📝', title: 'Text / URL / Image', desc: 'Three flexible input modes. Multilingual auto-detect included.' },
            { icon: '🤖', title: 'AI Detection', desc: 'Detects AI-generated content and assigns an AI-likelihood score.' },
            { icon: '✅', title: 'Claim Verification', desc: 'Every claim cross-checked against fact-check databases and news APIs.' },
          ].map((f) => (
            <div key={f.title} className="bg-gray-800 rounded-lg p-5 border border-gray-700">
              <div className="text-3xl mb-2">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
