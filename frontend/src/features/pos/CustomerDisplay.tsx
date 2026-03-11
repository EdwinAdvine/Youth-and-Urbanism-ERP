import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../store/auth'

interface CartItem {
  name: string
  quantity: number
  unit_price: number
  discount_amount?: number
}

interface DisplayState {
  items: CartItem[]
  subtotal: number
  tax: number
  total: number
  loyalty_points?: number
  customer_name?: string
  status: 'idle' | 'active' | 'completed'
}

/**
 * Customer-Facing Display — full-screen second-monitor view.
 * Connects via WebSocket to receive real-time cart state from the terminal.
 * Open this on a separate screen/tablet facing the customer.
 *
 * URL: /pos/customer-display?terminal=TERMINAL_ID
 */
export default function CustomerDisplay() {
  const token = useAuthStore((s) => s.token)
  const [state, setState] = useState<DisplayState>({
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    status: 'idle',
  })
  const wsRef = useRef<WebSocket | null>(null)

  // Get terminal ID from URL params
  const terminalId = new URLSearchParams(window.location.search).get('terminal') || 'default'

  useEffect(() => {
    if (!token) return

    const connect = () => {
      const ws = new WebSocket(
        `ws://localhost:8000/api/v1/pos/customer-display/ws/${terminalId}?token=${token}`
      )

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'cart_update') {
            setState({
              items: data.items || [],
              subtotal: data.subtotal || 0,
              tax: data.tax || 0,
              total: data.total || 0,
              loyalty_points: data.loyalty_points,
              customer_name: data.customer_name,
              status: 'active',
            })
          } else if (data.type === 'sale_completed') {
            setState((prev) => ({ ...prev, status: 'completed' }))
            setTimeout(() => {
              setState({ items: [], subtotal: 0, tax: 0, total: 0, status: 'idle' })
            }, 5000)
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        // Reconnect after 3 seconds
        setTimeout(connect, 3000)
      }

      wsRef.current = ws
    }

    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [token, terminalId])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-200">Your Order</h1>
        </div>
        {state.customer_name && (
          <div className="text-sm text-gray-400">
            Welcome, <span className="text-primary font-medium">{state.customer_name}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {state.status === 'idle' ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <p className="text-2xl font-light text-gray-500">Welcome</p>
              <p className="text-sm text-gray-600 mt-2">Your items will appear here</p>
            </div>
          </div>
        ) : state.status === 'completed' ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-green-400">Thank You!</p>
              <p className="text-lg text-gray-400 mt-2">Have a great day</p>
              {state.loyalty_points && state.loyalty_points > 0 && (
                <p className="text-sm text-yellow-400 mt-4">
                  You earned <span className="font-bold">{state.loyalty_points}</span> loyalty points
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Items list */}
            <div className="flex-1 overflow-auto px-8 py-4">
              <div className="space-y-3">
                {state.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3 border-b border-gray-800/50"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500 w-8 text-center">{item.quantity}x</span>
                      <span className="text-lg">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-medium">
                        ${(item.unit_price * item.quantity).toFixed(2)}
                      </span>
                      {(item.discount_amount || 0) > 0 && (
                        <p className="text-xs text-green-400">-${item.discount_amount?.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="px-8 py-6 bg-gray-800/50 border-t border-gray-700">
              <div className="space-y-2 text-lg">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal</span>
                  <span>${state.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Tax</span>
                  <span>${state.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-3xl font-bold pt-3 border-t border-gray-700">
                  <span>Total</span>
                  <span className="text-primary">${state.total.toFixed(2)}</span>
                </div>
              </div>

              {state.loyalty_points && state.loyalty_points > 0 && (
                <div className="mt-4 flex items-center gap-2 text-sm text-yellow-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>{state.loyalty_points} loyalty points available</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
