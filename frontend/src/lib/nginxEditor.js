// Shared CodeMirror 6 theme + nginx language — imported by ConfigEditor and AuthConfigPage
import { StreamLanguage } from '@codemirror/language'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { nginx } from '@codemirror/legacy-modes/mode/nginx'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

export const themeBase = EditorView.theme({
  '&': {
    backgroundColor: '#18181c',
    color: '#f0efe8',
    fontSize: '13px',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
  },
  '.cm-content': { caretColor: '#5c8fe2', padding: '0.75rem 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#5c8fe2' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { background: 'rgba(92,143,226,0.28)' },
  '.cm-gutters': {
    backgroundColor: '#18181c',
    color: '#5a5956',
    border: 'none',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    paddingRight: '4px',
    minWidth: '36px',
  },
  '.cm-lineNumbers .cm-gutterElement': { color: '#5a5956' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.04)', color: '#a09e98 !important' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.03)' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(92,143,226,0.25)', outline: 'none' },
  '.cm-line': { padding: '0 1rem 0 0.5rem' },
  '.cm-scroller': { lineHeight: '1.6', overflow: 'auto' },
}, { dark: true })

export const themeHighlight = HighlightStyle.define([
  { tag: t.comment,                 color: '#5a5956', fontStyle: 'italic' },
  { tag: t.keyword,                 color: '#5c8fe2' },   // directives
  { tag: t.definitionKeyword,       color: '#5c8fe2' },
  { tag: t.string,                  color: '#5cb87a' },   // strings
  { tag: t.number,                  color: '#e2a45c' },   // numbers/ports
  { tag: t.variableName,            color: '#c9a0dc' },   // $vars
  { tag: t.special(t.variableName), color: '#c9a0dc' },
  { tag: t.operator,                color: '#a09e98' },
  { tag: t.punctuation,             color: '#a09e98' },
  { tag: t.bracket,                 color: '#f0efe8' },   // braces {}
  { tag: t.bool,                    color: '#e2a45c' },
  { tag: t.meta,                    color: '#e2a45c' },
  { tag: t.atom,                    color: '#e2a45c' },
  { tag: t.url,                     color: '#5cb87a' },
])

export const nginxExtensions = [
  StreamLanguage.define(nginx),
  syntaxHighlighting(themeHighlight),
]
