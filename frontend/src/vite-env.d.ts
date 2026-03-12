/// <reference types="vite/client" />

declare module 'tailwind-merge' {
  export function twMerge(...args: (string | undefined | null | false)[]): string
}
