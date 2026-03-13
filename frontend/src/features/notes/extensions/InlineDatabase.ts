/**
 * InlineDatabase — TipTap Node extension for embedding database views inline
 * inside Notes pages (similar to Notion's /database embed).
 *
 * The extension itself only manages the ProseMirror node definition, attributes,
 * HTML serialisation, and commands. The React rendering of the actual database
 * widget is handled by NoteBlockEditor via a custom node view renderer that reads
 * the `data-database-id`, `data-view-type`, and `data-title` attributes.
 *
 * Node type:  inlineDatabase
 * Level:      block (isInline = false)
 * Attributes: databaseId, viewType, title
 *
 * Parsed from: <div class="inline-database-embed" ...>
 * Rendered as: <div class="inline-database-embed" data-database-id="..." ...>
 */

import { Node, mergeAttributes } from '@tiptap/core';

export interface InlineDatabaseAttributes {
  databaseId: string;
  viewType: 'table' | 'kanban' | 'list';
  title: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineDatabase: {
      /**
       * Insert an inline database embed block.
       * @param attrs Database attributes (databaseId, viewType, title).
       */
      insertInlineDatabase: (attrs: Partial<InlineDatabaseAttributes>) => ReturnType;
    };
  }
}

const InlineDatabase = Node.create({
  name: 'inlineDatabase',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      databaseId: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-database-id') ?? '',
        renderHTML: (attributes: InlineDatabaseAttributes) => ({
          'data-database-id': attributes.databaseId,
        }),
      },
      viewType: {
        default: 'table',
        parseHTML: (element: HTMLElement) =>
          (element.getAttribute('data-view-type') as InlineDatabaseAttributes['viewType']) ??
          'table',
        renderHTML: (attributes: InlineDatabaseAttributes) => ({
          'data-view-type': attributes.viewType,
        }),
      },
      title: {
        default: 'Database',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-title') ?? 'Database',
        renderHTML: (attributes: InlineDatabaseAttributes) => ({
          'data-title': attributes.title,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.inline-database-embed',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ class: 'inline-database-embed' }, HTMLAttributes),
    ];
  },

  addCommands() {
    return {
      insertInlineDatabase:
        (attrs: Partial<InlineDatabaseAttributes> = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              databaseId: attrs.databaseId ?? '',
              viewType: attrs.viewType ?? 'table',
              title: attrs.title ?? 'Database',
            },
          });
        },
    };
  },
});

export default InlineDatabase;
