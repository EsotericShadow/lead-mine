import { NextRequest, NextResponse } from 'next/server';

const HEADER_NAMES = ['authorization', 'x-api-key'];

export function requireIntegrationKey(request: NextRequest): NextResponse | null {
  const expected = process.env.INTEGRATION_API_KEY?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: 'Integration API key not configured' },
      { status: 500 }
    );
  }

  let provided: string | null = null;
  for (const header of HEADER_NAMES) {
    const value = request.headers.get(header);
    if (!value) continue;
    if (header === 'authorization' && value.startsWith('Bearer ')) {
      provided = value.slice(7);
      break;
    }
    provided = value;
    break;
  }

  if (!provided || provided.trim() !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
