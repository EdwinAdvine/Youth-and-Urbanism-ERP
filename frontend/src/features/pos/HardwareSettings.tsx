import { useState } from 'react'
import { Button, Badge, Card, Input, Spinner, toast } from '../../components/ui'
import apiClient from '../../api/client'
import { useQuery, useMutation } from '@tanstack/react-query'
import type { POSTerminalType } from '../../api/pos_ext'

// ─── Types ─────────────────────────────────────────────────────────────────────

type PrinterType = 'ESCPOS' | 'Star'
type ConnectionType = 'USB' | 'Network'

interface PrintPayload {
  terminal_id: string
  printer_type: PrinterType
  connection: ConnectionType
  ip_address?: string
}

interface DrawerPayload {
  terminal_id: string
}

interface ScaleReading {
  weight: number
  unit: string
  stable: boolean
}

interface TerminalsResponse {
  terminals: POSTerminalType[]
}

// ─── Sub-section: Receipt Printer ─────────────────────────────────────────────

function PrinterSection({ terminals }: { terminals: POSTerminalType[] }) {
  const [terminalId, setTerminalId] = useState('')
  const [printerType, setPrinterType] = useState<PrinterType>('ESCPOS')
  const [connection, setConnection] = useState<ConnectionType>('USB')
  const [ipAddress, setIpAddress] = useState('')

  const testPrint = useMutation({
    mutationFn: async (payload: PrintPayload) => {
      const { data } = await apiClient.post('/pos/hardware/print', payload)
      return data
    },
    onSuccess: () => toast('success', 'Test print sent successfully'),
    onError:   () => toast('error', 'Test print failed'),
  })

  const handleTestPrint = () => {
    if (!terminalId) {
      toast('error', 'Please select a terminal')
      return
    }
    if (connection === 'Network' && !ipAddress.trim()) {
      toast('error', 'IP address is required for Network connection')
      return
    }
    testPrint.mutate({
      terminal_id: terminalId,
      printer_type: printerType,
      connection,
      ip_address: connection === 'Network' ? ipAddress.trim() : undefined,
    })
  }

  return (
    <Card>
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-[10px] bg-[#51459d]/10 flex items-center justify-center flex-shrink-0">
            <svg className="h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Receipt Printer</h3>
            <p className="text-sm text-gray-500">Configure and test the receipt printer</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Terminal selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Terminal</label>
            <select
              value={terminalId}
              onChange={(e) => setTerminalId(e.target.value)}
              className="w-full min-h-[40px] rounded-[10px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/50"
            >
              <option value="">Select terminal…</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.location ? `— ${t.location}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Printer type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Printer Type</label>
            <div className="flex gap-2">
              {(['ESCPOS', 'Star'] as const).map((pt) => (
                <button
                  key={pt}
                  onClick={() => setPrinterType(pt)}
                  className={`flex-1 min-h-[40px] rounded-[10px] border text-sm font-medium transition-all ${
                    printerType === pt
                      ? 'border-[#51459d] bg-[#51459d] text-white'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          {/* Connection type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Connection</label>
            <div className="flex gap-2">
              {(['USB', 'Network'] as const).map((ct) => (
                <button
                  key={ct}
                  onClick={() => setConnection(ct)}
                  className={`flex-1 min-h-[40px] rounded-[10px] border text-sm font-medium transition-all ${
                    connection === ct
                      ? 'border-[#51459d] bg-[#51459d] text-white'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>

          {/* IP address — only for Network */}
          {connection === 'Network' && (
            <div>
              <Input
                label="Printer IP Address"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="e.g. 192.168.1.150"
                type="text"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleTestPrint}
            loading={testPrint.isPending}
            disabled={!terminalId}
          >
            Test Print
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── Sub-section: Cash Drawer ──────────────────────────────────────────────────

function DrawerSection({ terminals }: { terminals: POSTerminalType[] }) {
  const [terminalId, setTerminalId] = useState('')

  const openDrawer = useMutation({
    mutationFn: async (payload: DrawerPayload) => {
      const { data } = await apiClient.post('/pos/hardware/open-drawer', payload)
      return data
    },
    onSuccess: () => toast('success', 'Cash drawer opened'),
    onError:   () => toast('error', 'Failed to open cash drawer'),
  })

  const handleOpen = () => {
    if (!terminalId) {
      toast('error', 'Please select a terminal')
      return
    }
    openDrawer.mutate({ terminal_id: terminalId })
  }

  return (
    <Card>
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-[10px] bg-[#6fd943]/10 flex items-center justify-center flex-shrink-0">
            <svg className="h-5 w-5 text-[#6fd943]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Cash Drawer</h3>
            <p className="text-sm text-gray-500">Manually trigger the cash drawer to open</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Terminal</label>
            <select
              value={terminalId}
              onChange={(e) => setTerminalId(e.target.value)}
              className="w-full min-h-[40px] rounded-[10px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/50"
            >
              <option value="">Select terminal…</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.location ? `— ${t.location}` : ''}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleOpen}
            loading={openDrawer.isPending}
            disabled={!terminalId}
            className="sm:mb-0"
          >
            Open Drawer
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── Sub-section: Scale ────────────────────────────────────────────────────────

function ScaleSection({ terminals }: { terminals: POSTerminalType[] }) {
  const [terminalId, setTerminalId] = useState('')
  const [reading, setReading] = useState<ScaleReading | null>(null)

  const readWeight = useMutation({
    mutationFn: async (tid: string) => {
      const { data } = await apiClient.get<ScaleReading>('/pos/hardware/scale/read', {
        params: { terminal_id: tid },
      })
      return data
    },
    onSuccess: (data) => {
      setReading(data)
      toast('success', `Weight read: ${data.weight} ${data.unit}`)
    },
    onError: () => {
      setReading(null)
      toast('error', 'Failed to read scale')
    },
  })

  const handleRead = () => {
    if (!terminalId) {
      toast('error', 'Please select a terminal')
      return
    }
    readWeight.mutate(terminalId)
  }

  return (
    <Card>
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-[10px] bg-[#3ec9d6]/10 flex items-center justify-center flex-shrink-0">
            <svg className="h-5 w-5 text-[#3ec9d6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Scale</h3>
            <p className="text-sm text-gray-500">Read weight from connected POS scale</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Terminal</label>
            <select
              value={terminalId}
              onChange={(e) => { setTerminalId(e.target.value); setReading(null) }}
              className="w-full min-h-[40px] rounded-[10px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/50"
            >
              <option value="">Select terminal…</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.location ? `— ${t.location}` : ''}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleRead}
            loading={readWeight.isPending}
            disabled={!terminalId}
          >
            Read Weight
          </Button>
        </div>

        {/* Weight reading result */}
        {readWeight.isPending && (
          <div className="flex items-center gap-3 rounded-[10px] bg-[#3ec9d6]/5 border border-[#3ec9d6]/20 p-4">
            <Spinner size="sm" />
            <span className="text-sm text-gray-500">Reading scale…</span>
          </div>
        )}

        {reading && !readWeight.isPending && (
          <div className="rounded-[10px] border border-[#3ec9d6]/30 bg-[#3ec9d6]/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Weight Reading</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {reading.weight}
                <span className="text-lg font-medium text-gray-500 ml-1">{reading.unit}</span>
              </p>
            </div>
            <Badge variant={reading.stable ? 'success' : 'warning'}>
              {reading.stable ? 'Stable' : 'Unstable'}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HardwareSettings() {
  const { data, isLoading, error } = useQuery<TerminalsResponse>({
    queryKey: ['pos-terminals'],
    queryFn: async () => {
      const { data } = await apiClient.get<TerminalsResponse>('/pos/terminals')
      return data
    },
  })

  const terminals = data?.terminals ?? []

  if (error) {
    return (
      <div className="p-6 text-[#ff3a6e] font-medium">
        Failed to load terminals. Please refresh the page.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hardware Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure POS peripherals per terminal</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          <PrinterSection terminals={terminals} />
          <DrawerSection  terminals={terminals} />
          <ScaleSection   terminals={terminals} />
        </div>
      )}
    </div>
  )
}

export { HardwareSettings }
