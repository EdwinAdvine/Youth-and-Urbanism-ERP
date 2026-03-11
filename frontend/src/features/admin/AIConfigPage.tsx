import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAIConfig, useUpdateAIConfig, useTestAIConnection } from '../../api/admin'
import { Card, Button, Input, Select, Spinner, Badge } from '../../components/ui'

const schema = z.object({
  provider: z.enum(['ollama', 'openai', 'anthropic', 'grok']),
  model: z.string().min(1, 'Model is required'),
  api_key: z.string().optional(),
  ollama_url: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const PROVIDER_OPTIONS = [
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'grok', label: 'Grok (xAI)' },
]

const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  ollama: [
    { value: 'llama3.2', label: 'Llama 3.2' },
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'codellama', label: 'Code Llama' },
    { value: 'phi3', label: 'Phi-3' },
    { value: 'gemma2', label: 'Gemma 2' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  ],
  grok: [
    { value: 'grok-beta', label: 'Grok Beta' },
    { value: 'grok-2', label: 'Grok 2' },
  ],
}

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
    control,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { provider: 'ollama', model: 'llama3.2', ollama_url: 'http://ollama:11434' },
  })

  useEffect(() => {
    if (config) {
      reset({
        provider: config.provider,
        model: config.model,
        api_key: config.api_key ?? '',
        ollama_url: config.ollama_url ?? 'http://ollama:11434',
      })
    }
  }, [config, reset])

  const provider = watch('provider')
  const modelOptions = MODEL_OPTIONS[provider] ?? []

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
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
        <p className="text-gray-500 text-sm mt-1">Configure the AI provider powering Urban AI assistant</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Provider */}
          <Select
            label="AI Provider"
            options={PROVIDER_OPTIONS}
            error={errors.provider?.message}
            {...register('provider')}
          />

          {/* Ollama URL — only for ollama */}
          {provider === 'ollama' && (
            <Input
              label="Ollama Base URL"
              placeholder="http://ollama:11434"
              error={errors.ollama_url?.message}
              {...register('ollama_url')}
            />
          )}

          {/* API Key — for non-ollama providers */}
          {provider !== 'ollama' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-…"
                  className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
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
          )}

          {/* Model */}
          <Controller
            name="model"
            control={control}
            render={({ field }) => (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <select
                  {...field}
                  className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                >
                  {modelOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.model && <p className="text-xs text-danger">{errors.model.message}</p>}
              </div>
            )}
          />

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
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
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

      {/* Provider info cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'ollama', name: 'Ollama', desc: 'Free, runs locally on your server. Best for privacy.', badge: 'Free', badgeVariant: 'success' as const },
          { id: 'openai', name: 'OpenAI', desc: 'GPT-4o and family. Best performance, paid API.', badge: 'Paid', badgeVariant: 'warning' as const },
          { id: 'anthropic', name: 'Anthropic', desc: 'Claude models. Excellent reasoning, paid API.', badge: 'Paid', badgeVariant: 'warning' as const },
          { id: 'grok', name: 'Grok', desc: 'xAI Grok. Real-time data access, paid API.', badge: 'Paid', badgeVariant: 'warning' as const },
        ].map((p) => (
          <div
            key={p.id}
            className={`p-3 rounded-[10px] border transition-colors cursor-pointer ${provider === p.id ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white hover:border-gray-200'}`}
            onClick={() => reset({ ...watch(), provider: p.id as FormData['provider'] })}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-800">{p.name}</p>
              <Badge variant={p.badgeVariant}>{p.badge}</Badge>
            </div>
            <p className="text-xs text-gray-500">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
