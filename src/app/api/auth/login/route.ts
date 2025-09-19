import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername, verifyPassword, updateLastLogin } from '@/lib/users';
import { LoginSchema, signToken, setAuthCookie, checkRateLimit } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : headersList.get('x-real-ip') || 'unknown';
    
    // Rate limiting
    if (!checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          }
        }
      );
    }

    const body = await request.json();
    
    // Validate input
    const result = LoginSchema.safeParse(body);
    if (!result.success) {
      const formatted = result.error.flatten();
      return NextResponse.json(
        { error: 'Invalid input', details: formatted.fieldErrors },
        { status: 400 }
      );
    }

    const { username, password } = result.data;

    // Find user
    const user = await findUserByUsername(username);
    if (!user) {
      // Use a generic error message to prevent user enumeration
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    await updateLastLogin(user.id);

    // Generate JWT token
    const token = await signToken({
      userId: user.id,
      username: user.username,
    });

    // Set secure cookie
    const cookieOptions = setAuthCookie(token);
    
    const response = NextResponse.json(
      { 
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
        }
      },
      { status: 200 }
    );

    // Set the cookie
    response.cookies.set(cookieOptions);

    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
