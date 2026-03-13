/**
 * InlineComment — wraps editor text with a visual highlight
 * indicating there are one or more inline comments anchored to it.
 *
 * Usage inside a TipTap NodeView or custom mark renderer:
 *
 *   <InlineComment commentCount={3} blockId="block-abc" onOpenComments={openSidebar}>
 *     highlighted text here
 *   </InlineComment>
 */
import React, { useState } from 'react';

interface InlineCommentProps {
  /** Number of comments anchored to this text span. */
  commentCount: number;
  /** TipTap block / node id used to filter comments in the sidebar. */
  blockId?: string;
  /** Called when the user clicks to open the comments sidebar for this block. */
  onOpenComments: (blockId: string) => void;
  children: React.ReactNode;
}

export default function InlineComment({
  commentCount,
  blockId = '',
  onOpenComments,
  children,
}: InlineCommentProps) {
  const [hovered, setHovered] = useState(false);

  // If there are no comments, render children without any decoration.
  if (commentCount === 0) {
    return <>{children}</>;
  }

  return (
    <span
      className="relative cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpenComments(blockId)}
      style={{ position: 'relative', display: 'inline' }}
    >
      {/* Highlighted, underlined text */}
      <span
        className="bg-yellow-100 dark:bg-yellow-900/30 underline decoration-yellow-400 decoration-2 underline-offset-2"
        style={{ textDecorationStyle: 'wavy' }}
      >
        {children}
      </span>

      {/* Comment count badge — shown on hover */}
      {hovered && (
        <span
          className="absolute -top-5 left-0 z-50 flex items-center gap-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap pointer-events-none"
          style={{ transform: 'translateY(0)' }}
          aria-label={`${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
        >
          <svg
            className="h-2.5 w-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {commentCount}
        </span>
      )}
    </span>
  );
}
