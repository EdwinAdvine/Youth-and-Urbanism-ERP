import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, Spinner, toast } from '../../components/ui'
import { useCart, useCheckout, useShippingMethods, useValidateCoupon, type CheckoutPayload } from '../../api/ecommerce_ext'

type Step = 'address' | 'shipping' | 'payment' | 'confirm'
const STEPS: Step[] = ['address', 'shipping', 'payment', 'confirm']
const stepLabels: Record<Step, string> = { address: 'Address', shipping: 'Shipping', payment: 'Payment', confirm: 'Confirm' }

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { data: cart, isLoading: cartLoading } = useCart()
  const { data: shippingMethods, isLoading: shippingLoading } = useShippingMethods({ is_active: true })
  const checkout = useCheckout()
  const validateCoupon = useValidateCoupon()

  const [step, setStep] = useState<Step>('address')
  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null)

  const [address, setAddress] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  })
  const [selectedShipping, setSelectedShipping] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [notes, setNotes] = useState('')

  const currentIdx = STEPS.indexOf(step)

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    try {
      const result = await validateCoupon.mutateAsync(couponCode)
      if (result.valid) {
        setCouponDiscount(result.discount_amount)
        toast('success', result.message || 'Coupon applied')
      } else {
        toast('error', result.message || 'Invalid coupon')
      }
    } catch {
      toast('error', 'Failed to validate coupon')
    }
  }

  const handleCheckout = async () => {
    const payload: CheckoutPayload = {
      shipping_address_id: 'new',
      shipping_method_id: selectedShipping,
      payment_method: paymentMethod,
      coupon_code: couponCode || undefined,
      notes: notes || undefined,
    }
    try {
      await checkout.mutateAsync(payload)
      toast('success', 'Order placed successfully!')
      navigate('/ecommerce/orders')
    } catch {
      toast('error', 'Failed to place order')
    }
  }

  const canGoNext = () => {
    switch (step) {
      case 'address': return address.address_line1 && address.city && address.country
      case 'shipping': return !!selectedShipping
      case 'payment': return !!paymentMethod
      default: return true
    }
  }

  if (cartLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 mb-4">Your cart is empty</p>
        <Button onClick={() => navigate('/ecommerce/catalog')}>Browse Products</Button>
      </div>
    )
  }

  const selectedMethodObj = shippingMethods?.find((m) => m.id === selectedShipping)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Checkout</h1>

      {/* Step indicator - responsive */}
      <div className="flex items-center justify-between sm:justify-start sm:gap-2 overflow-x-auto px-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              className={`w-9 h-9 sm:w-8 sm:h-8 min-w-[36px] sm:min-w-[32px] rounded-full text-sm font-medium flex items-center justify-center transition-colors active:scale-95 ${ i < currentIdx ? 'bg-primary text-white' : i === currentIdx ? 'bg-primary text-white ring-2 ring-primary/30 ring-offset-2' : 'bg-gray-100 text-gray-400' }`}
              onClick={() => i < currentIdx && setStep(s)}
              disabled={i > currentIdx}
            >
              {i < currentIdx ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </button>
            <span className={`text-xs sm:text-sm hidden xs:inline ${i <= currentIdx ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
              {stepLabels[s]}
            </span>
            {i < STEPS.length - 1 && <div className={`w-4 sm:w-12 h-0.5 ${i < currentIdx ? 'bg-primary' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {step === 'address' && (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
              <div className="space-y-4">
                <Input label="Address Line 1" value={address.address_line1} onChange={(e) => setAddress({ ...address, address_line1: e.target.value })} required />
                <Input label="Address Line 2" value={address.address_line2} onChange={(e) => setAddress({ ...address, address_line2: e.target.value })} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required />
                  <Input label="State / Province" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Postal Code" value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })} />
                  <Input label="Country" value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} required />
                </div>
              </div>
            </Card>
          )}

          {step === 'shipping' && (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Shipping Method</h2>
              {shippingLoading ? (
                <Spinner />
              ) : (
                <div className="space-y-3">
                  {(shippingMethods ?? []).map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-4 p-4 rounded-[10px] border cursor-pointer transition-colors min-h-[56px] active:scale-[0.98] ${ selectedShipping === m.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300' }`}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        value={m.id}
                        checked={selectedShipping === m.id}
                        onChange={() => setSelectedShipping(m.id)}
                        className="text-primary w-5 h-5"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{m.name}</p>
                        <p className="text-sm text-gray-500">{m.estimated_days_min}-{m.estimated_days_max} business days</p>
                        {m.description && <p className="text-xs text-gray-400 mt-1">{m.description}</p>}
                      </div>
                      <p className="font-semibold">${m.base_cost.toFixed(2)}</p>
                    </label>
                  ))}
                  {(!shippingMethods || shippingMethods.length === 0) && (
                    <p className="text-gray-400 text-center py-6">No shipping methods available</p>
                  )}
                </div>
              )}
            </Card>
          )}

          {step === 'payment' && (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
              <div className="space-y-3">
                {['card', 'mpesa', 'bank_transfer', 'cash_on_delivery'].map((method) => (
                  <label
                    key={method}
                    className={`flex items-center gap-4 p-4 rounded-[10px] border cursor-pointer transition-colors min-h-[56px] active:scale-[0.98] ${ paymentMethod === method ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300' }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                      className="text-primary w-5 h-5"
                    />
                    <span className="font-medium text-gray-900 capitalize">{method.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Coupon Code</h3>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                  />
                  <Button variant="outline" onClick={handleApplyCoupon} loading={validateCoupon.isPending}>
                    Apply
                  </Button>
                </div>
                {couponDiscount !== null && (
                  <p className="text-sm text-green-600 mt-1">Discount: -${couponDiscount.toFixed(2)}</p>
                )}
              </div>

              <div className="mt-4">
                <Input
                  label="Order Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions"
                />
              </div>
            </Card>
          )}

          {step === 'confirm' && (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Order Confirmation</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Shipping Address</h3>
                  <p className="text-sm text-gray-900">
                    {address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ''}
                    <br />{address.city}{address.state ? `, ${address.state}` : ''} {address.postal_code}
                    <br />{address.country}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Shipping Method</h3>
                  <p className="text-sm text-gray-900">{selectedMethodObj?.name ?? '-'} (${selectedMethodObj?.base_cost.toFixed(2)})</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Payment Method</h3>
                  <p className="text-sm text-gray-900 capitalize">{paymentMethod.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Items ({cart.items.length})</h3>
                  <div className="space-y-1">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.product_name} x {item.quantity}</span>
                        <span className="font-medium">${item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-4">
            <Button
              variant="ghost"
              className="flex-1 sm:flex-none min-h-[48px]"
              onClick={() => setStep(STEPS[currentIdx - 1])}
              disabled={currentIdx === 0}
            >
              Back
            </Button>
            {step === 'confirm' ? (
              <Button className="flex-1 sm:flex-none min-h-[52px] text-base font-semibold" onClick={handleCheckout} loading={checkout.isPending}>
                Place Order
              </Button>
            ) : (
              <Button className="flex-1 sm:flex-none min-h-[48px]" onClick={() => setStep(STEPS[currentIdx + 1])} disabled={!canGoNext()}>
                Continue
              </Button>
            )}
          </div>
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="text-gray-500 truncate mr-2">{item.product_name} x{item.quantity}</span>
                  <span>${item.total.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-2 flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>${cart.subtotal.toFixed(2)}</span>
              </div>
              {selectedMethodObj && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping</span>
                  <span>${selectedMethodObj.base_cost.toFixed(2)}</span>
                </div>
              )}
              {couponDiscount !== null && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${couponDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Tax</span>
                <span>${cart.tax_amount.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-2 flex justify-between font-semibold text-gray-900">
                <span>Total</span>
                <span className="text-lg">
                  ${(cart.total + (selectedMethodObj?.base_cost ?? 0) - (couponDiscount ?? 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
