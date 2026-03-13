import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAIConfig, useUpdateAIConfig, useTestAIConnection } from '../../api/admin'
import { Card, Button, Spinner, Badge } from '../../components/ui'

const schema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  model: z.string().min(1, 'Model is required'),
  api_key: z.string().optional(),
  base_url: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const PRESET_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o and family. Most popular, paid API.', base_url: '', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o4-mini'] },
  { id: 'anthropic', name: 'Anthropic', desc: 'Claude models. Excellent reasoning, paid API.', base_url: '', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514'] },
  { id: 'grok', name: 'Grok (xAI)', desc: 'xAI Grok. Real-time data, paid API.', base_url: 'https://api.x.ai/v1', models: ['grok-3', 'grok-3-mini', 'grok-2'] },
  { id: 'openrouter', name: 'OpenRouter', desc: 'Access 200+ models via one API.', base_url: 'https://openrouter.ai/api/v1', models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-exp'] },
  { id: 'together', name: 'Together AI', desc: 'Open-source models at scale.', base_url: 'https://api.together.xyz/v1', models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'] },
  { id: 'groq', name: 'Groq', desc: 'Ultra-fast inference for open models.', base_url: 'https://api.groq.com/openai/v1', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] },
  { id: 'custom', name: 'Custom Provider', desc: 'Any OpenAI-compatible API endpoint.', base_url: '', models: [] },
]

export default function AIConfigPage() {
  const { data: config, isLoading } = useAIConfig()
  const updateMutation = useUpdateAIConfig()
  const testMutation = useTestAIConnection()
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { provider: 'openai', model: 'gpt-4o', base_url: '' },
  })

  useEffect(() => {
    if (config) {
      reset({
        provider: config.provider,
        model: config.model,
        api_key: config.api_key ?? '',
        base_url: config.base_url ?? '',
      })
    }
  }, [config, reset])

  const provider = watch('provider')
  const preset = PRESET_PROVIDERS.find((p) => p.id === provider)

  const selectPreset = (presetId: string) => {
    const p = PRESET_PROVIDERS.find((x) => x.id === presetId)
    if (p) {
      setValue('provider', p.id, { shouldDirty: true })
      setValue('base_url', p.base_url, { shouldDirty: true })
      if (p.models.length > 0) {
        setValue('model', p.models[0], { shouldDirty: true })
      }
    }
  }

  const onSubmit = async (data: FormData) => {
    await updateMutation.mutateAsync(data)
    setTestResult(null)
  }

  const handleTest = async () => {
    const values = watch()
    setTestResult(null)
    try {
      const result = await testMutation.mutateAsync(values as FormData)
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: 'Connection failed. Check settings and try again.' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">AI Configuration</h1>
        <p className="text-gray-500 text-sm mt-1">Configure any AI provider — OpenAI-compatible or Anthropic</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Provider (free-form) */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
            <input
              type="text"
              placeholder="e.g. openai, anthropic, openrouter, groq, together, custom..."
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              {...register('provider')}
            />
            {errors.provider && <p className="text-xs text-danger">{errors.provider.message}</p>}
          </div>

          {/* Base URL */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Base URL <span className="text-gray-400 font-normal">(leave empty for OpenAI / Anthropic defaults)</span>
            </label>
            <input
              type="text"
              placeholder="https://api.example.com/v1"
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              {...register('base_url')}
            />
          </div>

          {/* API Key */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                {...register('api_key')}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Model */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
            <input
              type="text"
              placeholder="e.g. gpt-4o, claude-sonnet-4-20250514, llama-3.3-70b-versatile..."
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              {...register('model')}
            />
            {errors.model && <p className="text-xs text-danger">{errors.model.message}</p>}
            {preset && preset.models.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {preset.models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setValue('model', m, { shouldDirty: true })}
                    className="px-2 py-0.5 text-xs rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`rounded-[10px] p-3 text-sm ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                <span>{testResult.success ? '✓' : '✕'}</span>
                {testResult.message}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="secondary"
              onClick={handleTest}
              loading={testMutation.isPending}
            >
              Test Connection
            </Button>
            <div className="flex-1" />
            <Button type="submit" loading={updateMutation.isPending} disabled={!isDirty}>
              Save Configuration
            </Button>
          </div>
        </form>
      </Card>

      {/* Quick-select provider presets */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick presets</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PRESET_PROVIDERS.map((p) => (
            <div
              key={p.id}
              className={`p-3 rounded-[10px] border transition-colors cursor-pointer ${provider === p.id ? 'border-primary bg-primary/5' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200'}`}
              onClick={() => selectPreset(p.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{p.name}</p>
                {p.id !== 'custom' && <Badge variant="warning">Paid</Badge>}
              </div>
              <p className="text-xs text-gray-500">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
