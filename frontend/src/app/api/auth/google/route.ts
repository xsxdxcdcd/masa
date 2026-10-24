import { NextResponse } from 'next/server';

export async function GET() {
    const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');
    return NextResponse.redirect(`${backendUrl}/auth/google`);
}
