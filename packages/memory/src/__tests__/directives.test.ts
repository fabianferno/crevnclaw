import { describe, it, expect, afterEach } from 'vitest';
import { DirectiveLoader } from '../directives.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('DirectiveLoader', () => {
  const testDir = path.join(os.tmpdir(), 'crevnclaw-dir-' + Date.now(), 'identity');

  afterEach(() => {
    fs.rmSync(path.dirname(testDir), { recursive: true, force: true });
  });

  it('loads SOUL.md and AGENTS.md', () => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'SOUL.md'), '# I am CrevnClaw\nHelpful assistant.');
    fs.writeFileSync(path.join(testDir, 'AGENTS.md'), '# Agents\n- web_search');
    const loader = new DirectiveLoader(testDir);
    expect(loader.getSoul()).toContain('I am CrevnClaw');
    expect(loader.getAgents()).toContain('web_search');
  });

  it('returns empty string for missing files', () => {
    fs.mkdirSync(testDir, { recursive: true });
    const loader = new DirectiveLoader(testDir);
    expect(loader.getSoul()).toBe('');
  });
});
