import React from 'react';
import { AgentIcon, EMOJI_TO_ICON, AgentIconKind } from './agentIcons';

const CARET_SENTINEL = '\uE000';
export function formatInline(text: string): React.ReactNode {
  if (!text) return null;
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\uE000)/g);
  return tokens.map((token, i) => {
    if (token === CARET_SENTINEL) return <span key={i} className="streaming-caret" />;
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={i}
          style={{
            background: 'var(--bg-card)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--code-text)',
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)'
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text-main)', fontWeight: 700 }}>{token.slice(2, -2)}</strong>;
    }
    const parts = token.split(/(📖||🔎||✅||💻||🎉|⚠️||⏳|📤|✔|✘)/g);
    if (parts.length === 1) return token;
    return parts.map((p, j) => {
      const kind = EMOJI_TO_ICON[p] as AgentIconKind | undefined;
      return kind
        ? <AgentIcon key={`${i}-${j}`} kind={kind} size={13} color="var(--accent-green)" style={{ margin: '0 3px' }} />
        : p;
    });
  });
}

function renderMarkdownTable(tableLines: string[], key: number | string) {
  const cleanRows = tableLines
    .map(line => line.trim())
    .filter(line => line.startsWith('|') && line.endsWith('|'))
    .map(line => line.slice(1, -1).split('|').map(cell => cell.trim()));

  if (cleanRows.length < 2) return null;

  const headers = cleanRows[0];
  const dataRows = cleanRows.slice(2);

  return (
    <div key={key} style={{ margin: '14px 0', overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        background: 'var(--bg-table)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        fontSize: '12.5px',
        overflow: 'hidden'
      }}>
        <thead>
          <tr style={{ background: 'var(--bg-table-head)', borderBottom: '1px solid var(--border-subtle)' }}>
            {headers.map((h, hIdx) => (
              <th key={hIdx} style={{ padding: '8px 12px', textAlign: 'inherit', fontWeight: 700, color: 'var(--text-main)' }}>
                {formatInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, rIdx) => (
            <tr key={rIdx} style={{ borderBottom: rIdx < dataRows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ padding: '8px 12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  {formatInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div dir="auto" style={{ lineHeight: '1.75', fontSize: '13px', color: 'var(--text-main)' }}>
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
           const lines = part.slice(3, -3).trim().split('\n');
           const firstLine = lines[0].trim();
           const lang = /^[a-zA-Z0-9_-]+$/.test(firstLine) ? firstLine : '';
           const codeBody = lang ? lines.slice(1).join('\n') : lines.join('\n');
           const codeLines = codeBody.split('\n');
           const MAX_DISPLAY_LINES = 200;
           const displayCode = codeLines.length > MAX_DISPLAY_LINES
             ? codeLines.slice(0, MAX_DISPLAY_LINES).join('\n') + `\n\n... (${codeLines.length - MAX_DISPLAY_LINES} more lines hidden)`
             : codeBody;
          return (
            <div 
              key={idx} 
              dir="ltr"
              style={{ 
                margin: '12px 0', 
                borderRadius: '8px', 
                overflow: 'hidden', 
                border: '1px solid var(--border-subtle)', 
                background: 'var(--bg-code)' 
              }}
            >
              {lang && (
                <div style={{ padding: '4px 10px', background: 'rgba(255, 255, 255, 0.04)', fontSize: '11px', color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>{lang}</span>
                </div>
              )}
               <pre style={{ margin: 0, padding: '10px 12px', fontSize: '12px', overflowX: 'auto', color: 'var(--code-text)', fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)' }}>
                 {displayCode}
               </pre>
            </div>
          );
        }

        const paragraphs = part.split('\n\n');
        return paragraphs.map((para, pIdx) => {
          const lines = para.split('\n');

          const isTable = lines.length >= 2 && lines[0].trim().startsWith('|') && lines[1].trim().includes('---');
          if (isTable) {
            return renderMarkdownTable(lines, `${idx}-${pIdx}`);
          }

          return (
            <div key={`${idx}-${pIdx}`} style={{ marginBottom: pIdx < paragraphs.length - 1 ? '12px' : '0' }}>
              {lines.map((line, lIdx) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('### ')) {
                  return <h4 key={lIdx} style={{ fontSize: '14px', fontWeight: 700, margin: '14px 0 6px', color: 'var(--text-main)' }}>{formatInline(trimmed.slice(4))}</h4>;
                }
                if (trimmed.startsWith('## ')) {
                  return <h3 key={lIdx} style={{ fontSize: '15px', fontWeight: 700, margin: '16px 0 8px', color: 'var(--text-main)' }}>{formatInline(trimmed.slice(3))}</h3>;
                }
                if (trimmed.startsWith('# ')) {
                  return <h2 key={lIdx} style={{ fontSize: '17px', fontWeight: 800, margin: '18px 0 8px', color: 'var(--text-main)' }}>{formatInline(trimmed.slice(2))}</h2>;
                }
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                  return (
                    <div key={lIdx} style={{ display: 'flex', gap: '8px', margin: '4px 0', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--accent-green)', lineHeight: '1.75' }}>•</span>
                      <span style={{ flex: 1 }}>{formatInline(trimmed.slice(2))}</span>
                    </div>
                  );
                }
                return <div key={lIdx}>{formatInline(line)}</div>;
              })}
            </div>
          );
        });
      })}
    </div>
  );
}
