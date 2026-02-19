import fs from 'node:fs';
import path from 'node:path';

export class DirectiveLoader {
  private identityDir: string;

  constructor(identityDir: string) {
    this.identityDir = identityDir;
  }

  getSoul(): string {
    return this.readFile('SOUL.md');
  }

  getAgents(): string {
    return this.readFile('AGENTS.md');
  }

  private readFile(filename: string): string {
    const filePath = path.join(this.identityDir, filename);
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  }
}
