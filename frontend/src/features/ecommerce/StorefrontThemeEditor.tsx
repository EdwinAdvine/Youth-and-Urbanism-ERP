import { useState, useEffect } from 'react'
import { cn, Button, Card, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import { useEcomStores, useUpdateStore } from '../../api/ecommerce'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThemeSettings {
  primary_color: string
  secondary_color: string
  accent_color: string
  text_color: string
  background_color: string
  logo_url: string
  font_family: string
  header_content: string
  footer_content: string
  border_radius: string
  button_style: 'rounded' | 'pill' | 'square'
}

const DEFAULT_THEME: ThemeSettings = {
  primary_color: '#51459d',
  secondary_color: '#6fd943',
  accent_color: '#3ec9d6',
  text_color: '#1f2937',
  background_color: '#ffffff',
  logo_url: '',
  font_family: 'Open Sans',
  header_content: 'Welcome to our store',
  footer_content: '© 2026 Your Store. All rights reserved.',
  border_radius: '10px',
  button_style: 'rounded',
}

const FONT_OPTIONS = [
  'Open Sans',
  'Inter',
  'Roboto',
  'Poppins',
  'Lato',
  'Montserrat',
  'Nunito',
  'Playfair Display',
  'DM Sans',
  'Plus Jakarta Sans',
]

const PRESET_THEMES = [
  { name: 'Urban Default', primary: '#51459d', secondary: '#6fd943', accent: '#3ec9d6' },
  { name: 'Midnight', primary: '#1e1b4b', secondary: '#7c3aed', accent: '#06b6d4' },
  { name: 'Forest', primary: '#065f46', secondary: '#34d399', accent: '#fbbf24' },
  { name: 'Sunset', primary: '#9a3412', secondary: '#f97316', accent: '#fbbf24' },
  { name: 'Ocean', primary: '#164e63', secondary: '#22d3ee', accent: '#2dd4bf' },
  { name: 'Rose', primary: '#9f1239', secondary: '#fb7185', accent: '#fda4af' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function StorefrontThemeEditor() {
  const { data: stores } = useEcomStores()
  const updateStore = useUpdateStore()

  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME)
  const [isDirty, setIsDirty] = useState(false)

  // Auto-select first store
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id)
    }
  }, [stores, selectedStoreId])

  // Load theme from store settings
  useEffect(() => {
    if (!selectedStoreId || !stores) return
    const store = stores.find((s) => s.id === selectedStoreId)
    if (store?.settings_json && typeof store.settings_json === 'object') {
      const saved = store.settings_json.theme as Partial<ThemeSettings> | undefined
      if (saved) {
        setTheme({ ...DEFAULT_THEME, ...saved })
      } else {
        setTheme(DEFAULT_THEME)
      }
    } else {
      setTheme(DEFAULT_THEME)
    }
    setIsDirty(false)
  }, [selectedStoreId, stores])

  function update<K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) {
    setTheme((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  function applyPreset(preset: typeof PRESET_THEMES[0]) {
    setTheme((prev) => ({
      ...prev,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
      accent_color: preset.accent,
    }))
    setIsDirty(true)
  }

  async function handleSave() {
    if (!selectedStoreId) return
    const store = stores?.find((s) => s.id === selectedStoreId)
    try {
      await updateStore.mutateAsync({
        id: selectedStoreId,
        settings_json: {
          ...(store?.settings_json ?? {}),
          theme,
        },
      })
      toast('success', 'Theme settings saved')
      setIsDirty(false)
    } catch {
      toast('error', 'Failed to save theme')
    }
  }

  function handleReset() {
    setTheme(DEFAULT_THEME)
    setIsDirty(true)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Storefront Theme Editor</h1>
          <p className="text-sm text-gray-500 mt-1">Customize your storefront appearance</p>
        </div>
        <div className="flex items-center gap-3">
          {stores && stores.length > 1 && (
            <select
              className="rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={handleReset}>Reset</Button>
          <Button size="sm" onClick={handleSave} loading={updateStore.isPending} disabled={!isDirty}>
            Save Theme
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-6">
          {/* Color Presets */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Quick Presets</h2>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_THEMES.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-gray-100 dark:border-gray-800 hover:border-primary/40 transition-colors text-left"
                >
                  <div className="flex -space-x-1">
                    <div className="w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: preset.primary }} />
                    <div className="w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: preset.secondary }} />
                    <div className="w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: preset.accent }} />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{preset.name}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Colors */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Colors</h2>
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Primary" value={theme.primary_color} onChange={(v) => update('primary_color', v)} />
              <ColorField label="Secondary" value={theme.secondary_color} onChange={(v) => update('secondary_color', v)} />
              <ColorField label="Accent" value={theme.accent_color} onChange={(v) => update('accent_color', v)} />
              <ColorField label="Text" value={theme.text_color} onChange={(v) => update('text_color', v)} />
              <ColorField label="Background" value={theme.background_color} onChange={(v) => update('background_color', v)} />
            </div>
          </Card>

          {/* Typography */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Typography</h2>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Font Family</label>
              <select
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={theme.font_family}
                onChange={(e) => update('font_family', e.target.value)}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </Card>

          {/* Logo & Branding */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Branding</h2>
            <div className="space-y-3">
              <Input
                label="Logo URL"
                value={theme.logo_url}
                onChange={(e) => update('logo_url', e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Button Style</label>
                <div className="flex gap-2">
                  {(['rounded', 'pill', 'square'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => update('button_style', style)}
                      className={cn(
                        'px-4 py-1.5 text-xs font-medium border transition-colors',
                        style === 'rounded' && 'rounded-lg',
                        style === 'pill' && 'rounded-full',
                        style === 'square' && 'rounded-none',
                        theme.button_style === style
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label="Border Radius"
                value={theme.border_radius}
                onChange={(e) => update('border_radius', e.target.value)}
                placeholder="10px"
              />
            </div>
          </Card>

          {/* Content */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Header & Footer Content</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Header Content</label>
                <textarea
                  value={theme.header_content}
                  onChange={(e) => update('header_content', e.target.value)}
                  rows={2}
                  className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
                  placeholder="Welcome banner text..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Footer Content</label>
                <textarea
                  value={theme.footer_content}
                  onChange={(e) => update('footer_content', e.target.value)}
                  rows={2}
                  className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
                  placeholder="Copyright notice, links..."
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Preview</h2>
            <div
              className="rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden"
              style={{ fontFamily: theme.font_family, color: theme.text_color, backgroundColor: theme.background_color }}
            >
              {/* Header */}
              <div className="px-4 py-3" style={{ backgroundColor: theme.primary_color }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {theme.logo_url ? (
                      <img src={theme.logo_url} alt="Logo" className="h-8 w-8 object-contain rounded" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                        S
                      </div>
                    )}
                    <span className="text-white font-semibold text-sm">Store Name</span>
                  </div>
                  <div className="flex gap-3 text-white/80 text-xs">
                    <span>Shop</span>
                    <span>About</span>
                    <span>Cart (0)</span>
                  </div>
                </div>
              </div>

              {/* Banner */}
              {theme.header_content && (
                <div className="px-4 py-2 text-center text-xs" style={{ backgroundColor: theme.accent_color, color: '#fff' }}>
                  {theme.header_content}
                </div>
              )}

              {/* Product Grid Preview */}
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-3" style={{ color: theme.text_color }}>Featured Products</h3>
                <div className="grid grid-cols-3 gap-3">
                  {['Product A', 'Product B', 'Product C'].map((name) => (
                    <div key={name} className="border border-gray-100 rounded-lg overflow-hidden" style={{ borderRadius: theme.border_radius }}>
                      <div className="h-16 bg-gray-100" />
                      <div className="p-2">
                        <p className="text-xs font-medium" style={{ color: theme.text_color }}>{name}</p>
                        <p className="text-xs mt-0.5" style={{ color: theme.primary_color }}>KES 1,500</p>
                        <button
                          className={cn(
                            'mt-1.5 w-full py-1 text-[10px] font-medium text-white',
                            theme.button_style === 'pill' && 'rounded-full',
                            theme.button_style === 'rounded' && 'rounded-lg',
                            theme.button_style === 'square' && 'rounded-none',
                          )}
                          style={{ backgroundColor: theme.secondary_color }}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-100 text-center" style={{ backgroundColor: theme.primary_color + '10' }}>
                <p className="text-[10px]" style={{ color: theme.text_color + '99' }}>
                  {theme.footer_content}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── ColorField ──────────────────────────────────────────────────────────────

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  )
}
