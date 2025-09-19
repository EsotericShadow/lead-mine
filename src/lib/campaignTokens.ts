import crypto from 'crypto';

export function generateInviteToken() {
  return crypto.randomBytes(24).toString('base64url');
}
