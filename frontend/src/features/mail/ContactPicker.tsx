import { useState, useRef, useEffect } from 'react'
import { useMailContacts } from '../../api/mail'

interface ContactPickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}

export default function ContactPicker({ value, onChange, placeholder = 'Recipients', label }: ContactPickerProps) {
  const [focused, setFocused] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse existing chips from the comma-separated value
  const chips = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // Search contacts
  const { data: contacts } = useMailContacts(inputVal.length >= 1 ? inputVal : undefined)
  const filteredContacts = (contacts ?? []).filter(
    (c) => !chips.includes(c.email) && (
      c.email.toLowerCase().includes(inputVal.toLowerCase()) ||
      (c.name ?? '').toLowerCase().includes(inputVal.toLowerCase())
    ),
  )

  useEffect(() => {
    setShowDropdown(focused && inputVal.length >= 1 && filteredContacts.length > 0)
  }, [focused, inputVal, filteredContacts.length])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const addChip = (email: string) => {
    const updated = [...chips, email].join(', ')
    onChange(updated)
    setInputVal('')
    inputRef.current?.focus()
  }

  const removeChip = (email: string) => {
    const updated = chips.filter((c) => c !== email).join(', ')
    onChange(updated)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === 'Tab' || e.key === ',') && inputVal.trim()) {
      e.preventDefault()
      // If there's a matching contact, use it; otherwise add the raw input as email
      const match = filteredContacts.find(
        (c) => c.email.toLowerCase() === inputVal.trim().toLowerCase(),
      )
      addChip(match?.email ?? inputVal.trim())
    } else if (e.key === 'Backspace' && !inputVal && chips.length > 0) {
      removeChip(chips[chips.length - 1])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <span className="text-xs text-gray-400 w-12 shrink-0">{label}</span>
      )}
      <div
        className={`flex flex-wrap items-center gap-1 px-2 py-1.5 min-h-[36px] border rounded-[8px] transition-colors cursor-text ${ focused ? 'border-[#51459d] ring-1 ring-[#51459d]/20' : 'border-gray-200' }`}
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 bg-[#51459d]/10 text-[#51459d] text-xs px-2 py-0.5 rounded-full max-w-[200px]"
          >
            <span className="truncate">{email}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeChip(email) }}
              className="shrink-0 hover:text-[#3d3480] transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            if (inputVal.trim()) addChip(inputVal.trim())
            setFocused(false)
          }}
          onKeyDown={handleKeyDown}
          placeholder={chips.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] text-sm text-gray-900 dark:text-gray-100 focus:outline-none placeholder:text-gray-400 bg-transparent"
        />
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] shadow-lg max-h-48 overflow-y-auto">
          {filteredContacts.map((contact) => (
            <button
              key={contact.email}
              onMouseDown={(e) => { e.preventDefault(); addChip(contact.email) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-[#51459d]/5 transition-colors flex items-center gap-2"
            >
              <div className="w-6 h-6 rounded-full bg-[#51459d]/10 text-[#51459d] flex items-center justify-center text-[10px] font-bold shrink-0">
                {(contact.name ?? contact.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                {contact.name && (
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{contact.name}</p>
                )}
                <p className="text-[11px] text-gray-500 truncate">{contact.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
