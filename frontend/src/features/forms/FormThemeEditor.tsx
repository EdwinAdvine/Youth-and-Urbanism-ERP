import { useState, useEffect } from 'react'
import { useSaveTheme } from '@/api/forms'

interface FormTheme {
  primary_color: string
  background_color: string
  text_color: string
  font_family: string
  logo_url: string
  header_image_url: string
  border_radius: number
  show_progress_bar: boolean
}

const DEFAULT_THEME: FormTheme = {
  primary_color: '#51459d',
  background_color: '#ffffff',
  text_color: '#1f2937',
  font_family: 'Open Sans',
  logo_url: '',
  header_image_url: '',
  border_radius: 10,
  show_progress_bar: true,
}

const FONT_OPTIONS = [
  'Open Sans',
  'Inter',
  'Roboto',
  'Lato',
  'Poppins',
  'Montserrat',
  'Nunito',
  'Source Sans Pro',
  'PT Sans',
  'System Default',
]

const PRESET_THEMES: { name: string; theme: Partial<FormTheme> }[] = [
  { name: 'Y&U Default', theme: { primary_color: '#51459d', background_color: '#ffffff', text_color: '#1f2937' } },
  { name: 'Ocean Blue', theme: { primary_color: '#0369a1', background_color: '#f0f9ff', text_color: '#0c4a6e' } },
  { name: 'Forest Green', theme: { primary_color: '#15803d', background_color: '#f0fdf4', text_color: '#14532d' } },
  { name: 'Sunset Orange', theme: { primary_color: '#c2410c', background_color: '#fff7ed', text_color: '#7c2d12' } },
  { name: 'Rose', theme: { primary_color: '#be123c', background_color: '#fff1f2', text_color: '#881337' } },
  { name: 'Slate', theme: { primary_color: '#475569', background_color: '#f8fafc', text_color: '#1e293b' } },
  { name: 'Dark Mode', theme: { primary_color: '#818cf8', background_color: '#1e1b4b', text_color: '#e0e7ff' } },
]

interface FormThemeEditorProps {
  formId: string
  currentTheme?: Partial<FormTheme>
  onSaved?: () => void
}

export default function FormThemeEditor({ formId, currentTheme, onSaved }: FormThemeEditorProps) {
  const [theme, setTheme] = useState<FormTheme>({ ...DEFAULT_THEME, ...currentTheme })
  const saveTheme = useSaveTheme()

  useEffect(() => {
    setTheme({ ...DEFAULT_THEME, ...currentTheme })
  }, [currentTheme])

  const update = (key: keyof FormTheme, value: string | number | boolean) => {
    setTheme((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    saveTheme.mutate(
      { formId, theme },
      { onSuccess: () => onSaved?.() }
    )
  }

  const applyPreset = (preset: Partial<FormTheme>) => {
    setTheme((prev) => ({ ...prev, ...preset }))
  }

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Presets</h4>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_THEMES.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p.theme)}
              className="flex flex-col items-center gap-1.5 p-2 border border-gray-200 dark:border-gray-700 rounded-[8px] hover:border-[#51459d] transition-colors"
            >
              <div className="flex gap-0.5">
                <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: p.theme.primary_color }} />
                <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: p.theme.background_color }} />
                <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: p.theme.text_color }} />
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Colors</h4>
        <div className="space-y-3">
          {([
            ['primary_color', 'Primary Color'],
            ['background_color', 'Background'],
            ['text_color', 'Text Color'],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="color"
                value={theme[key]}
                onChange={(e) => update(key, e.target.value)}
                className="w-8 h-8 rounded-[6px] border border-gray-200 dark:border-gray-700 cursor-pointer p-0"
              />
              <div className="flex-1">
                <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>
                <input
                  type="text"
                  value={theme[key]}
                  onChange={(e) => update(key, e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-[11px] font-mono bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-[6px]"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Font */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Font Family</h4>
        <select
          value={theme.font_family}
          onChange={(e) => update('font_family', e.target.value)}
          className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-[8px]"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Logo & Header Image */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Logo URL</label>
          <input
            type="url"
            value={theme.logo_url}
            onChange={(e) => update('logo_url', e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full mt-1 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-[8px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Header Image URL</label>
          <input
            type="url"
            value={theme.header_image_url}
            onChange={(e) => update('header_image_url', e.target.value)}
            placeholder="https://example.com/header.jpg"
            className="w-full mt-1 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-[8px]"
          />
        </div>
      </div>

      {/* Border Radius */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Border Radius</label>
          <span className="text-[11px] text-gray-400">{theme.border_radius}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={24}
          value={theme.border_radius}
          onChange={(e) => update('border_radius', parseInt(e.target.value))}
          className="w-full accent-[#51459d]"
        />
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-600 dark:text-gray-400">Show Progress Bar</label>
        <button
          onClick={() => update('show_progress_bar', !theme.show_progress_bar)}
          className={`w-9 h-5 rounded-full transition-colors ${theme.show_progress_bar ? 'bg-[#51459d]' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${theme.show_progress_bar ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Preview */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Preview</h4>
        <div
          className="border border-gray-200 dark:border-gray-700 p-4"
          style={{
            backgroundColor: theme.background_color,
            borderRadius: `${theme.border_radius}px`,
            fontFamily: theme.font_family === 'System Default' ? undefined : theme.font_family,
          }}
        >
          {theme.logo_url && (
            <img src={theme.logo_url} alt="Logo" className="h-8 mb-3" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}
          <h3 style={{ color: theme.text_color }} className="text-sm font-semibold mb-2">Sample Question</h3>
          <p style={{ color: theme.text_color }} className="text-xs opacity-70 mb-3">This is how your form will look</p>
          <div
            className="px-3 py-2 text-xs border"
            style={{
              borderColor: theme.primary_color + '40',
              borderRadius: `${Math.min(theme.border_radius, 8)}px`,
              color: theme.text_color,
            }}
          >
            Answer here...
          </div>
          <button
            className="mt-3 px-4 py-1.5 text-xs text-white"
            style={{
              backgroundColor: theme.primary_color,
              borderRadius: `${Math.min(theme.border_radius, 8)}px`,
            }}
          >
            Submit
          </button>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saveTheme.isPending}
        className="w-full py-2.5 text-xs font-semibold text-white bg-[#51459d] hover:bg-[#3d3480] rounded-[8px] transition-colors disabled:opacity-50"
      >
        {saveTheme.isPending ? 'Saving...' : 'Save Theme'}
      </button>
    </div>
  )
}
