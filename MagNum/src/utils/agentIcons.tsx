import React from 'react';

export type AgentIconKind =
  | 'read' | 'search' | 'patch' | 'create' | 'command'
  | 'finish' | 'approve' | 'reject' | 'warn' | 'think' | 'upload' | 'globe';

interface IconProps { kind: AgentIconKind; size?: number; color?: string; style?: React.CSSProperties; }

export const AgentIcon: React.FC<IconProps> = ({ kind, size = 14, color = 'currentColor', style }) => {
  const s: React.CSSProperties = { display: 'inline-block', flexShrink: 0, verticalAlign: '-2px', ...style };
  const st = { fill: 'none', stroke: color, strokeWidth: 1.3, strokeLinejoin: 'round' as const };
  const fl = { fill: color, stroke: 'none' };
  let body: React.ReactNode = null;
  switch (kind) {
    case 'read':
      body = (<><polygon points="4,1.5 9.5,1.5 12.5,4.5 12.5,14.5 4,14.5" {...st} /><polygon points="9.5,1.5 9.5,4.5 12.5,4.5" {...st} /><polygon points="6,7 10.5,7 10.5,8 6,8" {...fl} /><polygon points="6,9.5 10.5,9.5 10.5,10.5 6,10.5" {...fl} /></>);
      break;
    case 'search':
      body = (<><polygon points="7,2 10.8,4.2 10.8,8.6 7,10.8 3.2,8.6 3.2,4.2" {...st} /><polygon points="10.1,9.7 11.1,8.9 14,12.2 13,13" {...fl} /></>);
      break;
    case 'patch':
      body = (<><polygon points="8,1.5 14.5,8 8,14.5 1.5,8" {...st} /><polygon points="7.4,4.8 8.6,4.8 8.6,7.4 11.2,7.4 11.2,8.6 8.6,8.6 8.6,11.2 7.4,11.2 7.4,8.6 4.8,8.6 4.8,7.4 7.4,7.4" {...fl} /></>);
      break;
    case 'create':
      body = (<><polygon points="4,1.5 9.5,1.5 12.5,4.5 12.5,14.5 4,14.5" {...st} /><polygon points="7.5,5.5 8.5,5.5 8.5,7.5 10.5,7.5 10.5,8.5 8.5,8.5 8.5,10.5 7.5,10.5 7.5,8.5 5.5,8.5 5.5,7.5 7.5,7.5" {...fl} /></>);
      break;
    case 'command':
      body = (<><polygon points="1.5,2.5 14.5,2.5 14.5,13.5 1.5,13.5" {...st} /><polygon points="4,5.5 7,8 4,10.5 4.9,11.3 8.6,8 4.9,4.7" {...fl} /><polygon points="9,10.5 12.5,10.5 12.5,11.4 9,11.4" {...fl} /></>);
      break;
    case 'finish':
    case 'approve':
      body = (<polygon points="3,8.2 6.2,11.4 13,3.4 14.4,4.7 6.2,14 1.6,9.6" {...fl} />);
      break;
    case 'reject':
      body = (<><polygon points="3,4 4,3 13,12 12,13" {...fl} /><polygon points="12,3 13,4 4,13 3,12" {...fl} /></>);
      break;
    case 'warn':
      body = (<><polygon points="8,1.8 15,14 1,14" {...st} /><polygon points="7.5,5.5 8.5,5.5 8.5,10 7.5,10" {...fl} /><polygon points="7.5,11.2 8.5,11.2 8.5,12.2 7.5,12.2" {...fl} /></>);
      break;
    case 'think':
      body = (<polygon points="8,1 9.6,5.6 14.5,5.6 10.6,8.6 12.1,13.4 8,10.5 3.9,13.4 5.4,8.6 1.5,5.6 6.4,5.6" {...fl} />);
      break;
    case 'upload':
      body = (<><polygon points="8,1.5 12,5.5 9,5.5 9,10 7,10 7,5.5 4,5.5" {...fl} /><polygon points="2.5,11.5 13.5,11.5 13.5,14.5 2.5,14.5" {...st} /></>);
      break;
    case 'globe':
      body = (<><circle cx="8" cy="8" r="6.2" {...st} /><ellipse cx="8" cy="8" rx="2.7" ry="6.2" {...st} /><polygon points="2,7.6 14,7.6 14,8.4 2,8.4" {...fl} /></>);
      break;
  }
  return <svg width={size} height={size} viewBox="0 0 16 16" style={s}>{body}</svg>;
};

export const EMOJI_TO_ICON: Record<string, AgentIconKind> = {
  '📖': 'read', '🔍': 'search', '🔎': 'search', '📝': 'patch', '✅': 'approve', '✔': 'approve',
  '❌': 'reject', '✘': 'reject', '💻': 'command', '📄': 'create', '🎉': 'finish',
  '⚠️': 'warn', '🛑': 'warn', '⏳': 'think', '📤': 'upload'
};

export const ACTION_TO_ICON: Record<string, AgentIconKind> = {
  read_files: 'read', read_file: 'read', continue_reading: 'read',
  search_code: 'search', list_dir: 'read', patch_file: 'patch', create_file: 'create',
  execute_command: 'command', finish: 'finish',
  browse_web: 'globe', read_page: 'read'
};
