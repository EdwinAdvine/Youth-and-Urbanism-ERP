import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Use this whenever rendering user-generated or external HTML via dangerouslySetInnerHTML.
 */
export const sanitizeHTML = (dirty: string): string =>
  DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'span', 'div', 'em', 'strong', 'hr', 'sub', 'sup',
      'dl', 'dt', 'dd', 'figure', 'figcaption', 'mark',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'class', 'style', 'target', 'rel',
      'width', 'height', 'title', 'id',
    ],
    ALLOW_DATA_ATTR: false,
  });
