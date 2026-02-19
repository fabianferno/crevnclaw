import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';

const TOKEN_FILENAME = '.pairing-token';

export interface PairingOptions {
  jwtSecret: string;
  baseDir: string;
  expiresIn?: string;
}

export function generate(options: PairingOptions): string {
  const token = jwt.sign(
    { type: 'pairing', iss: 'crevnclaw' },
    options.jwtSecret,
    { expiresIn: (options.expiresIn || '24h') as jwt.SignOptions['expiresIn'] }
  );

  const tokenPath = path.join(options.baseDir, TOKEN_FILENAME);
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });

  return token;
}

export function validate(token: string, jwtSecret: string): jwt.JwtPayload {
  const decoded = jwt.verify(token, jwtSecret);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token format');
  }
  return decoded;
}

export function readToken(baseDir: string): string {
  const tokenPath = path.join(baseDir, TOKEN_FILENAME);
  return fs.readFileSync(tokenPath, 'utf-8').trim();
}
