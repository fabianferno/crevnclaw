import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generate, validate, readToken } from '../pairing.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const JWT_SECRET = 'test-pairing-secret';

describe('CLI Pairing', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kernel-pairing-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates a token and writes it to .pairing-token file', () => {
    const token = generate({ jwtSecret: JWT_SECRET, baseDir: tmpDir });

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    const tokenPath = path.join(tmpDir, '.pairing-token');
    expect(fs.existsSync(tokenPath)).toBe(true);

    const fileContent = fs.readFileSync(tokenPath, 'utf-8').trim();
    expect(fileContent).toBe(token);
  });

  it('validates a generated token successfully', () => {
    const token = generate({ jwtSecret: JWT_SECRET, baseDir: tmpDir });
    const decoded = validate(token, JWT_SECRET);

    expect(decoded.type).toBe('pairing');
    expect(decoded.iss).toBe('crevnclaw');
    expect(decoded.exp).toBeDefined();
  });

  it('rejects an invalid token', () => {
    expect(() => validate('garbage-token', JWT_SECRET)).toThrow();
  });

  it('rejects a token signed with wrong secret', () => {
    const token = generate({ jwtSecret: JWT_SECRET, baseDir: tmpDir });
    expect(() => validate(token, 'wrong-secret')).toThrow();
  });

  it('reads token from file', () => {
    const token = generate({ jwtSecret: JWT_SECRET, baseDir: tmpDir });
    const readBack = readToken(tmpDir);
    expect(readBack).toBe(token);
  });

  it('supports custom expiresIn option', () => {
    const token = generate({
      jwtSecret: JWT_SECRET,
      baseDir: tmpDir,
      expiresIn: '1h',
    });
    const decoded = validate(token, JWT_SECRET);
    expect(decoded.exp).toBeDefined();
  });
});
