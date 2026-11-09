export function getFileLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx': return 'javascript';
    case 'ts':
    case 'tsx': return 'typescript';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'json': return 'json';
    case 'py': return 'python';
    case 'rs': return 'rust';
    case 'go': return 'go';
    case 'md': return 'markdown';
    case 'sql': return 'sql';
    case 'sh': return 'shell';
    case 'yml':
    case 'yaml': return 'yaml';
    default: return 'plaintext';
  }
}
