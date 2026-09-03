import { mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Plugin } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImageView } from './ResizableImageView';
import {
  isFreeImage,
  isNoteImageAlign,
  isNoteImageLayout,
  parseCoord,
  parsePxAttr,
  type NoteImageAlign,
  type NoteImageLayout,
} from './noteImageLayout';
import { duplicateImageAt, updateCanvasExtent } from './noteImageInsert';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImageLayout: (layout: NoteImageLayout) => ReturnType;
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
      layout: {
        default: 'flow' satisfies NoteImageLayout,
        parseHTML: element => {
          const value = element.getAttribute('data-layout');
          return isNoteImageLayout(value) ? value : 'flow';
        },
        renderHTML: attributes => ({
          'data-layout': isFreeImage(attributes) ? 'free' : 'flow',
        }),
      },
      x: {
        default: null,
        parseHTML: element => parseCoord(element.getAttribute('data-x')),
        renderHTML: attributes =>
          attributes.x == null ? {} : { 'data-x': String(attributes.x) },
      },
      y: {
        default: null,
        parseHTML: element => parseCoord(element.getAttribute('data-y')),
        renderHTML: attributes =>
          attributes.y == null ? {} : { 'data-y': String(attributes.y) },
      },
      z: {
        default: 1,
        parseHTML: element => parseCoord(element.getAttribute('data-z')) ?? 1,
        renderHTML: attributes =>
          attributes.z && attributes.z !== 1 ? { 'data-z': String(attributes.z) } : {},
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
            layout: 'flow',
            x: null,
            y: null,
            z: 1,
            align: 'center',
            width: null,
            ...options,
          },
        }),
      setImageLayout:
        layout =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            layout,
            ...(layout === 'flow' ? { x: null, y: null } : {}),
          }),
      setImageAlign:
        align =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { align }),
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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view() {
          return {
            update(view) {
              updateCanvasExtent(view);
            },
          };
        },
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView, {
      className: 'note-image-node',
      attrs: ({ node }) => {
        const free = isFreeImage(node.attrs);
        const x = parseCoord(node.attrs.x);
        const y = parseCoord(node.attrs.y);
        const z = Number(node.attrs.z) || 1;
        const style: string[] = [];
        if (free && x != null && y != null) {
          style.push(`left:${x}px`, `top:${y}px`, `z-index:${z}`);
        }
        return {
          'data-layout': free ? 'free' : 'flow',
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
