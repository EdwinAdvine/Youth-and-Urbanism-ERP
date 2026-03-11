/**
 * Design tokens — centralized theme constants for Urban ERP
 */

export const colors = {
  primary: '#51459d',
  success: '#6fd943',
  info: '#3ec9d6',
  warning: '#ffa21d',
  danger: '#ff3a6e',
} as const

export const typography = {
  fontFamily: "'Open Sans', sans-serif",
  borderRadius: '10px',
} as const

export const moduleColors: Record<string, string> = {
  Finance: colors.primary,
  HR: colors.info,
  CRM: colors.success,
  Projects: colors.warning,
  Inventory: colors.danger,
  Drive: '#4a90d9',
  Notes: '#9b59b6',
  Calendar: '#e67e22',
  'AI Assistant': '#2ecc71',
  Users: '#95a5a6',
  Mail: '#d35400',
  Docs: '#2980b9',
  Teams: '#8e44ad',
  Forms: '#1abc9c',
  Analytics: '#34495e',
  Support: '#c0392b',
  'Supply Chain': '#27ae60',
  Manufacturing: '#f39c12',
  POS: '#e74c3c',
  'E-Commerce': '#3498db',
}
