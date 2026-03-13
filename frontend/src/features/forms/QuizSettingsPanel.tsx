import { useState } from 'react'

interface QuizSettingsPanelProps {
  formId: string
  settings: Record<string, unknown>
  onSave: (settings: Record<string, unknown>) => void
}

export default function QuizSettingsPanel({ formId: _formId, settings, onSave }: QuizSettingsPanelProps) {
  const [quizMode, setQuizMode] = useState<boolean>(Boolean(settings.quiz_mode))
  const [passThreshold, setPassThreshold] = useState<number>(
    typeof settings.quiz_pass_threshold === 'number' ? settings.quiz_pass_threshold : 60
  )
  const [showScore, setShowScore] = useState<boolean>(Boolean(settings.quiz_show_score))
  const [showAnswers, setShowAnswers] = useState<boolean>(Boolean(settings.quiz_show_answers))
  const [aiGrading, setAiGrading] = useState<boolean>(Boolean(settings.quiz_ai_grading))

  function handleSave() {
    onSave({
      ...settings,
      quiz_mode: quizMode,
      quiz_pass_threshold: passThreshold,
      quiz_show_score: showScore,
      quiz_show_answers: showAnswers,
      quiz_ai_grading: aiGrading,
    })
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'Open Sans, sans-serif' }}>
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Quiz Mode</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Enable quiz mode to score responses and track pass/fail rates.
        </p>

        {/* Quiz Mode Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Quiz Mode</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Score respondents and track pass/fail rates
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={quizMode}
            onClick={() => setQuizMode(!quizMode)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              quizMode ? 'bg-[#51459d] focus:ring-[#51459d]' : 'bg-gray-200 dark:bg-gray-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                quizMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Quiz Options — shown only when enabled */}
      {quizMode && (
        <div className="space-y-4 pl-1">
          {/* Pass Threshold Slider */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Pass Threshold
              </label>
              <span
                className="text-sm font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: '#51459d' }}
              >
                {passThreshold}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={passThreshold}
              onChange={(e) => setPassThreshold(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: '#51459d' }}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Show Score Toggle */}
          <ToggleRow
            label="Show Score to Respondent"
            description="Display their score immediately after submission"
            checked={showScore}
            onChange={setShowScore}
          />

          {/* Show Correct Answers Toggle */}
          <ToggleRow
            label="Show Correct Answers After Submit"
            description="Reveal which answers were correct once submitted"
            checked={showAnswers}
            onChange={setShowAnswers}
          />

          {/* AI Grading Toggle */}
          <ToggleRow
            label="Auto-Grade with AI"
            description="Use AI to grade open-ended and text responses automatically"
            checked={aiGrading}
            onChange={setAiGrading}
          />

          {/* Hint */}
          <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-[10px] border border-blue-200 dark:border-blue-800">
            <span className="text-blue-500 mt-0.5 text-base leading-none">ℹ</span>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Assign correct answers per field in the <strong>Field Editor</strong> by selecting each field and setting its correct answer or score.
            </p>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2 text-sm font-semibold text-white rounded-[10px] transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: '#51459d' }}
        >
          Save Quiz Settings
        </button>
      </div>
    </div>
  )
}

// ─── Helper sub-component ────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (val: boolean) => void
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          checked ? 'bg-[#51459d] focus:ring-[#51459d]' : 'bg-gray-200 dark:bg-gray-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
