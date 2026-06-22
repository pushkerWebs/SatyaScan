// Simulates the backend's multi-step analysis pipeline visually
const STEPS = [
  'Extracting text…',
  'Detecting language…',
  'Extracting claims…',
  'Verifying sources…',
  'Detecting AI content…',
  'Computing Trust Score…',
];

export default function LoadingState({ currentStep = 0 }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      {/* Spinner */}
      <div className="w-16 h-16 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mb-8" />

      <h2 className="text-white text-xl font-semibold mb-6">Analyzing content…</h2>

      {/* Step list */}
      <div className="space-y-3 text-left w-full max-w-xs">
        {STEPS.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={step} className="flex items-center gap-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${done ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-500'}`}>
                {done ? '✓' : i + 1}
              </span>
              <span className={`text-sm ${done ? 'text-green-400 line-through' : active ? 'text-white font-medium' : 'text-gray-500'}`}>
                {step}
              </span>
              {active && (
                <span className="ml-auto flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-gray-500 text-xs mt-8">This can take up to 60 seconds for complex content.</p>
    </div>
  );
}
