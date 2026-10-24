import { NextResponse } from 'next/server';

/**
 * Liveness probe for this service.
 *
 * The frontend has no page that answers `/health` — every non-prefixed path is
 * a 307 to the visitor's language — so a healthcheck pointed at a plain
 * `/health` or `/api/health` (the path the backend uses) gets a 404 or a
 * redirect and Railway marks the deployment FAILED even though the app is
 * serving normally. This route answers a plain 200 on the conventional paths
 * so a deploy can actually be verified.
 */
export function GET() {
    return NextResponse.json(
        { status: 'ok', service: 'frontend' },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
