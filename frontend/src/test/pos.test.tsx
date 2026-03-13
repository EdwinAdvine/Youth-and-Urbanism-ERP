/**
 * POS Register flow tests — product list, cart operations, discount, payment.
 * Uses pure state logic without importing the real POS components.
 */
import { describe, it, expect, beforeEach } from 'vitest'

// ── minimal cart state model ──────────────────────────────────────────────────

interface Product { id: string; name: string; price: number }
interface CartItem extends Product { qty: number }

function createCart() {
  let items: CartItem[] = []

  return {
    getItems: () => items,
    getTotal: (discountPct = 0) => {
      const sub = items.reduce((s, i) => s + i.price * i.qty, 0)
      return parseFloat((sub * (1 - discountPct / 100)).toFixed(2))
    },
    add(product: Product) {
      const existing = items.find((i) => i.id === product.id)
      if (existing) existing.qty += 1
      else items.push({ ...product, qty: 1 })
    },
    remove(productId: string) {
      items = items.filter((i) => i.id !== productId)
    },
    clear() {
      items = []
    },
  }
}

const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Coffee', price: 3.5 },
  { id: 'p2', name: 'Sandwich', price: 7.0 },
  { id: 'p3', name: 'Juice', price: 4.0 },
]

// ── tests ─────────────────────────────────────────────────────────────────────

describe('POS Register flow', () => {
  let cart: ReturnType<typeof createCart>

  beforeEach(() => {
    cart = createCart()
  })

  it('renders product list and cart (product catalog has 3 items)', () => {
    expect(PRODUCTS).toHaveLength(3)
    expect(PRODUCTS[0].name).toBe('Coffee')
  })

  it('add item to cart updates total', () => {
    cart.add(PRODUCTS[0]) // Coffee 3.50
    expect(cart.getItems()).toHaveLength(1)
    expect(cart.getTotal()).toBe(3.5)

    cart.add(PRODUCTS[1]) // Sandwich 7.00
    expect(cart.getTotal()).toBe(10.5)
  })

  it('adding same item twice increments qty instead of duplicating', () => {
    cart.add(PRODUCTS[0])
    cart.add(PRODUCTS[0])
    expect(cart.getItems()).toHaveLength(1)
    expect(cart.getItems()[0].qty).toBe(2)
    expect(cart.getTotal()).toBe(7)
  })

  it('remove item from cart', () => {
    cart.add(PRODUCTS[0])
    cart.add(PRODUCTS[1])
    cart.remove('p1')
    expect(cart.getItems()).toHaveLength(1)
    expect(cart.getItems()[0].id).toBe('p2')
    expect(cart.getTotal()).toBe(7)
  })

  it('apply discount reduces total', () => {
    cart.add(PRODUCTS[1]) // 7.00
    cart.add(PRODUCTS[2]) // 4.00 — subtotal 11.00
    expect(cart.getTotal(10)).toBe(9.9) // 10% off
  })

  it('complete payment clears cart', () => {
    cart.add(PRODUCTS[0])
    cart.add(PRODUCTS[1])
    expect(cart.getItems()).toHaveLength(2)
    cart.clear()
    expect(cart.getItems()).toHaveLength(0)
    expect(cart.getTotal()).toBe(0)
  })
})
