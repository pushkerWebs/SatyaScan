import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import ShareModal from '../components/ShareModal';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTrustColor(score) {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function getTrustLabel(score) {
  if (score >= 70) return 'Trustworthy';
  if (score >= 40) return 'Questionable';
  return 'Low Trust / Likely Fake';
}

function getVerdictColor(verdict) {
  const map = {
    True: '#22c55e', Supported: '#22c55e',
    'Partially True': '#f59e0b',
    False: '#ef4444', Contradicted: '#ef4444', Misleading: '#f97316',
    Unverified: '#6b7280',
  };
  return map[verdict] || '#6b7280';
}

function getAIVerdict(aiLikelihood) {
  if (aiLikelihood >= 70) return { label: 'Very Likely AI-Generated', color: '#ef4444', icon: '🤖', bg: 'bg-red-900/30 border-red-700' };
  if (aiLikelihood >= 45) return { label: 'Possibly AI-Generated', color: '#f59e0b', icon: '⚠️', bg: 'bg-yellow-900/30 border-yellow-700' };
  return { label: 'Likely Human-Written', color: '#22c55e', icon: '✅', bg: 'bg-green-900/30 border-green-700' };
}

const INPUT_TYPE_ICONS = { text: '📝', url: '🔗', image: '🖼️' };
const INPUT_TYPE_LABELS = { text: 'Text Analysis', url: 'URL Analysis', image: 'Image (OCR) Analysis' };

// ─── Trust Score Gauge ───────────────────────────────────────────────────────

function TrustGauge({ score }) {
  const color = getTrustColor(score);
  const label = getTrustLabel(score);
  const data = [{ name: 'score', value: score }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-44 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="90%"
            startAngle={90} endAngle={-270} data={data}>
            <RadialBar background={{ fill: '#374151' }} dataKey="value"
              cornerRadius={6} fill={color} max={100} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-extrabold text-white">{score}</span>
          <span className="text-xs text-gray-400">/ 100</span>
        </div>
      </div>
      <span className="mt-2 font-bold text-base" style={{ color }}>{label}</span>
    </div>
  );
}

// ─── Confidence Breakdown ────────────────────────────────────────────────────

function ConfidenceBreakdown({ aiLikelihood, aiScore, sourceCredibility, trustScore }) {
  const data = [
    { name: 'AI Score\n(human-likeness)', value: aiScore ?? (100 - aiLikelihood), color: (aiScore ?? (100 - aiLikelihood)) >= 60 ? '#22c55e' : '#ef4444' },
    { name: 'Source Trust', value: sourceCredibility, color: sourceCredibility >= 60 ? '#22c55e' : '#f59e0b' },
    { name: 'Trust Score', value: trustScore, color: getTrustColor(trustScore) },
  ];

  return (
    <div className="flex-1 w-full">
      <h3 className="text-white font-semibold mb-4">Score Breakdown</h3>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#d1d5db', fontSize: 11 }} width={100} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            formatter={(v) => [`${v}/100`, '']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((e) => <Cell key={e.name} fill={e.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-gray-500 text-xs mt-1">
        AI Score = how human-like the content is (higher = less AI). Source Trust = domain credibility.
      </p>
    </div>
  );
}

// ─── Claim Card ──────────────────────────────────────────────────────────────

function ClaimCard({ claim }) {
  const [open, setOpen] = useState(false);
  const color = getVerdictColor(claim.verdict);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-gray-800/60 transition">
        <span className="text-gray-200 text-sm flex-1">{claim.text}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: color + '30', color }}>
            {claim.verdict}
          </span>
          <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-700 bg-gray-900/60 p-4 space-y-3">
          {claim.reasoning && (
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Reasoning</p>
              <p className="text-gray-300 text-sm">{claim.reasoning}</p>
            </div>
          )}
          {claim.sources?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase mb-1">
                Sources ({claim.sources.length})
              </p>
              <ul className="space-y-2">
                {claim.sources.map((src, i) => (
                  <li key={i} className="text-xs">
                    <a href={src.url || src} target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 hover:underline break-all font-medium">
                      {src.title || src.url || src}
                    </a>
                    {src.source && <span className="text-gray-500 ml-1">— {src.source}</span>}
                    {src.snippet && <p className="text-gray-500 mt-0.5">{src.snippet}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showShare, setShowShare] = useState(false);

  const result = location.state?.result;

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-center px-4">
        <p className="text-gray-400 mb-4">No results to display. Please run an analysis first.</p>
        <Link to="/analyze" className="text-blue-400 hover:underline">← Back to Analyze</Link>
      </div>
    );
  }

  const {
    inputType,
    trustScore,
    aiLikelihood,
    aiScore,
    aiReasoning,
    sourceCredibility,
    language,
    claims = [],
    checkId,
    apiWorking,
  } = result;

  const aiVerdict = getAIVerdict(aiLikelihood);

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Results Dashboard</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Input type badge */}
              {inputType && (
                <span className="text-xs bg-gray-800 border border-gray-600 text-gray-300 px-2 py-1 rounded-full">
                  {INPUT_TYPE_ICONS[inputType]} {INPUT_TYPE_LABELS[inputType]}
                </span>
              )}
              {/* Language badge */}
              {language && language !== 'unknown' && (
                <span className="text-xs bg-blue-900/40 border border-blue-700 text-blue-300 px-2 py-1 rounded-full">
                  🌐 {language.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/analyze')}
              className="text-sm border border-gray-600 text-gray-300 hover:border-gray-400 px-4 py-2 rounded-lg transition">
              ← New Analysis
            </button>
            {checkId && (
              <button onClick={() => setShowShare(true)}
                className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">
                Share / PDF
              </button>
            )}
          </div>
        </div>

        {/* ── API Warning Banner ── */}
        {apiWorking === false && (
          <div className="bg-amber-900/30 border border-amber-600 rounded-xl p-4">
            <p className="text-amber-300 text-sm font-semibold mb-1">
              ⚠️ API Keys Not Working — Showing Fallback Data
            </p>
            <p className="text-amber-400/80 text-xs">
              The scores below are <strong>not real</strong> — they are placeholder defaults because the <code>OPENAI_API_KEY</code> in your <code>Backend/.env</code> is invalid or expired.
              Update it with a working key and restart the backend to get real analysis.
            </p>
          </div>
        )}

        {/* ── AI VERDICT — Most Prominent Section ── */}
        <div className={`border rounded-xl p-5 ${aiVerdict.bg}`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{aiVerdict.icon}</span>
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">AI Content Detection</p>
              <p className="text-xl font-bold" style={{ color: aiVerdict.color }}>
                {aiVerdict.label}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-extrabold" style={{ color: aiVerdict.color }}>{aiLikelihood}%</p>
              <p className="text-xs text-gray-400">AI likelihood</p>
            </div>
          </div>

          {/* AI likelihood bar */}
          <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{
                width: `${aiLikelihood}%`,
                background: aiLikelihood >= 70 ? '#ef4444' : aiLikelihood >= 45 ? '#f59e0b' : '#22c55e',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mb-3">
            <span>0% — Human Written</span>
            <span>100% — AI Generated</span>
          </div>

          {aiReasoning && (
            <p className="text-sm text-gray-300 border-t border-gray-700/50 pt-3">{aiReasoning}</p>
          )}
        </div>

        {/* ── Trust Score + Score Breakdown ── */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 flex flex-col sm:flex-row gap-8 items-center">
          <TrustGauge score={trustScore} />
          <ConfidenceBreakdown
            aiLikelihood={aiLikelihood}
            aiScore={aiScore}
            sourceCredibility={sourceCredibility}
            trustScore={trustScore}
          />
        </div>

        {/* ── Claims / Evidence Panel ── */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-1">
            📋 Claim Analysis
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({claims.length} claim{claims.length !== 1 ? 's' : ''} extracted)
            </span>
          </h3>

          {/* Verdict summary */}
          {claims.length > 0 && (() => {
            const counts = { Supported: 0, True: 0, Contradicted: 0, False: 0, Misleading: 0, Unverified: 0 };
            claims.forEach(c => { if (c.verdict in counts) counts[c.verdict]++; });
            const trueCount = counts.Supported + counts.True;
            const falseCount = counts.Contradicted + counts.False + counts.Misleading;
            const unverified = counts.Unverified;
            return (
              <div className="flex gap-3 mt-2 mb-4 flex-wrap">
                {trueCount > 0 && <span className="text-xs bg-green-900/40 text-green-400 border border-green-800 px-2 py-1 rounded-full">✓ {trueCount} Supported</span>}
                {falseCount > 0 && <span className="text-xs bg-red-900/40 text-red-400 border border-red-800 px-2 py-1 rounded-full">✗ {falseCount} Contradicted</span>}
                {unverified > 0 && <span className="text-xs bg-gray-700 text-gray-400 border border-gray-600 px-2 py-1 rounded-full">? {unverified} Unverified</span>}
              </div>
            );
          })()}

          {claims.length === 0 ? (
            <p className="text-gray-500 text-sm mt-2">No specific claims could be extracted. This usually means the OpenAI API key is not working.</p>
          ) : (
            <div className="space-y-3">
              {claims.map((claim, i) => <ClaimCard key={i} claim={claim} />)}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {checkId && (
          <p className="text-gray-600 text-xs text-center">
            Check ID: <code className="text-gray-500">{checkId}</code>
            {' · '}
            <a href={`/report/${checkId}`} target="_blank" rel="noopener noreferrer"
              className="text-blue-500 hover:underline">
              Public report link
            </a>
          </p>
        )}
      </div>

      {showShare && checkId && (
        <ShareModal checkId={checkId} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
