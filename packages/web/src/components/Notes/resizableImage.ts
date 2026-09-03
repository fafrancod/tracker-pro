import { mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImageView } from './ResizableImageView';
import {
  isNoteImageAlign,
  normalizeWrap,
  parsePxAttr,
  type NoteImageAlign,
  type NoteImageWrap,
} from './noteImageLayout';
import { duplicateImageAt } from './noteImageInsert';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImageWrap: (wrap: NoteImageWrap) => ReturnType;
      setImageAlign: (align: NoteImageAlign) => ReturnType;
      duplicateImage: () => ReturnType;
    };
  }
}

export const ResizableImage = Image.extend({
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element =>
          parsePxAttr(element.getAttribute('width') || element.style.width),
        renderHTML: attributes =>
          attributes.width ? { width: String(attributes.width) } : {},
      },
      wrap: {
        default: 'left' satisfies NoteImageWrap,
        parseHTML: element => normalizeWrap(element.getAttribute('data-wrap')),
        renderHTML: attributes => ({
          'data-wrap': normalizeWrap(attributes.wrap),
        }),
      },
      layout: {
        default: 'flow',
        parseHTML: element => element.getAttribute('data-layout') || 'flow',
        renderHTML: attributes =>
          attributes.layout && attributes.layout !== 'flow'
            ? { 'data-layout': String(attributes.layout) }
            : {},
      },
      x: {
        default: null,
        parseHTML: element => {
          const n = parseInt(element.getAttribute('data-x') || '', 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: attributes =>
          attributes.x == null ? {} : { 'data-x': String(attributes.x) },
      },
      y: {
        default: null,
        parseHTML: element => {
          const n = parseInt(element.getAttribute('data-y') || '', 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: attributes =>
          attributes.y == null ? {} : { 'data-y': String(attributes.y) },
      },
      indent: {
        default: 0,
        parseHTML: element => {
          const n = parseInt(element.getAttribute('data-indent') || '', 10);
          return Number.isFinite(n) && n > 0 ? n : 0;
        },
        renderHTML: attributes =>
          attributes.indent ? { 'data-indent': String(attributes.indent) } : {},
      },
      align: {
        default: 'center' satisfies NoteImageAlign,
        parseHTML: element => {
          const value = element.getAttribute('data-align');
          return isNoteImageAlign(value) ? value : 'center';
        },
        renderHTML: attributes => ({
          'data-align': isNoteImageAlign(attributes.align) ? attributes.align : 'center',
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: this.options.allowBase64
          ? 'img[src]'
          : 'img[src]:not([src^="data:"])',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-note-image': '1',
      }),
    ];
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImage: options => ({ commands }) =>
        commands.insertContent({
          type: this.name,
          attrs: {
            wrap: 'left' as NoteImageWrap,
            align: 'center' as NoteImageAlign,
            indent: 0,
            width: null,
            ...options,
          },
        }),
      setImageWrap:
        wrap =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { wrap, indent: 0 }),
      setImageAlign:
        align =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            align,
            wrap: align === 'center' ? 'below' : align,
            indent: 0,
          }),
      duplicateImage:
        () =>
        ({ editor }) => {
          if (!editor.isActive(this.name)) return false;
          duplicateImageAt(editor, editor.state.selection.from);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-d': () => this.editor.commands.duplicateImage(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView, {
      className: 'note-image-node',
      attrs: ({ node }) => {
        const wrap = normalizeWrap(node.attrs.wrap);
        const align = isNoteImageAlign(node.attrs.align) ? node.attrs.align : 'center';
        const indent = Number(node.attrs.indent) || 0;
        const style: string[] = [];
        if (wrap === 'left' && indent > 0) style.push(`margin-left:${indent}px`);
        if (wrap === 'right' && indent > 0) style.push(`margin-right:${indent}px`);
        return {
          'data-wrap': wrap,
          'data-align': align,
          'data-note-image': '1',
          style: style.join(';'),
        };
      },
      stopEvent: ({ event }) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return false;
        if (target.closest('[data-image-ui]')) return true;
        if (target.closest('.note-image-frame')) {
          return (
            event.type === 'mousedown' ||
            event.type === 'pointerdown' ||
            event.type === 'touchstart' ||
            event.type === 'dragstart'
          );
        }
        return false;
      },
      ignoreMutation: ({ mutation }) => mutation.type === 'attributes',
    });
  },
});
