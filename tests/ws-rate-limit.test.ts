import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRateLimiter } from '../src/common/in-memory-rate-limiter';
import { ChatGateway } from '../src/chat/chat.gateway';
import { UserCacheService } from '../src/common/user-cache.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

/**
 * The HTTP throttler never sees a WebSocket frame. Before these limiters,
 * `chat:join` in a loop cost one database read per frame with nothing counting
 * them, and a handshake flood was unlimited. These tests pin the ceiling.
 */

const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing!!';
process.env.JWT_SECRET = SECRET;

const jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: '15m' } });

// ---------------------------------------------------------------------------
// The limiter itself
// ---------------------------------------------------------------------------

test('allows exactly `limit` attempts in the window, then blocks', () => {
    const rl = new InMemoryRateLimiter(3, 1000);
    assert.equal(rl.allow('k', 0), true);
    assert.equal(rl.allow('k', 1), true);
    assert.equal(rl.allow('k', 2), true);
    assert.equal(rl.allow('k', 3), false, 'the fourth attempt in the window is refused');
});

test('a blocked caller is allowed again once the window slides past', () => {
    const rl = new InMemoryRateLimiter(2, 1000);
    rl.allow('k', 0);
    rl.allow('k', 1);
    assert.equal(rl.allow('k', 2), false);
    // At t=1001 the t=0 and t=1 hits have both left the window.
    assert.equal(rl.allow('k', 1001), true);
});

test('keys are independent -- one caller cannot exhaust another', () => {
    const rl = new InMemoryRateLimiter(1, 1000);
    assert.equal(rl.allow('alice', 0), true);
    assert.equal(rl.allow('bob', 0), true);
    assert.equal(rl.allow('alice', 0), false);
    assert.equal(rl.allow('bob', 0), false);
});

test('prune drops only keys whose window has fully elapsed', () => {
    const rl = new InMemoryRateLimiter(5, 1000);
    rl.allow('old', 0);
    rl.allow('fresh', 2000);
    assert.equal(rl.size(), 2);

    rl.prune(1500); // 'old' elapsed, 'fresh' (t=2000) is in the future

    assert.equal(rl.size(), 1, 'the elapsed key is gone, the live one is kept');
    // And the surviving key retains its count, so pruning is not a reset.
    rl.allow('fresh', 2001);
    assert.equal(rl.size(), 1);
});

// ---------------------------------------------------------------------------
// The gateway: connection flood
// ---------------------------------------------------------------------------

function socket(ip: string, token?: string, joined: string[] = []) {
    return {
        handshake: {
            auth: token === undefined ? {} : { token },
            headers: { 'x-forwarded-for': ip },
            address: ip,
        },
        disconnected: false,
        disconnect() { this.disconnected = true; },
        join: async (room: string) => { joined.push(room); },
    } as any;
}

const ADMIN = { id: 'u1', email: 'a@b.test', role: Role.ADMIN, isActive: true, tokenVersion: 0 };

function adminOrStudent(id: string) {
    return id === 'u1'
        ? { ...ADMIN }
        : { id: 'u2', email: 's@b.test', role: Role.STUDENT, isActive: true, tokenVersion: 0 };
}

/**
 * The gateway copies `userId` from the database row, not the token, so the
 * double must answer per id -- otherwise both users collapse onto one key and
 * the per-user test would pass for the wrong reason.
 */
function gatewayFor() {
    const cache = { findActiveUser: async (id: string) => adminOrStudent(id) };
    const chatService = {
        userHasRoomAccess: async () => true,
        userHasDirectAccess: async () => true,
    };
    return new ChatGateway(jwt, chatService as never, cache as unknown as UserCacheService);
}

test('SECURITY: a handshake flood from one IP is capped', async () => {
    const gw = gatewayFor();
    const token = jwt.sign({ sub: 'u1', role: Role.ADMIN, tv: 0 });

    let opened = 0;
    let refused = 0;
    for (let i = 0; i < 31; i++) {
        const client = socket('9.9.9.9', token);
        await gw.handleConnection(client);
        if (client.disconnected) refused++;
        else opened++;
    }

    assert.equal(opened, 30, 'thirty handshakes are allowed in the window');
    assert.equal(refused, 1, 'the thirty-first is cut before its token is verified');
});

test('the connection limit is per IP, not global', async () => {
    const gw = gatewayFor();
    const token = jwt.sign({ sub: 'u1', role: Role.ADMIN, tv: 0 });

    for (let i = 0; i < 30; i++) await gw.handleConnection(socket('1.1.1.1', token));

    // A different address must still get its own full allowance.
    const neighbour = socket('2.2.2.2', token);
    await gw.handleConnection(neighbour);

    assert.equal(neighbour.disconnected, false);
});

// ---------------------------------------------------------------------------
// The gateway: event flood on an established socket
// ---------------------------------------------------------------------------

test('SECURITY: chat:join on an established socket is rate limited before lookup', async () => {
    const gw = gatewayFor();
    const token = jwt.sign({ sub: 'u1', role: Role.ADMIN, tv: 0 });
    const client = socket('3.3.3.3', token);
    await gw.handleConnection(client);
    assert.equal(client.disconnected, false);

    let lookups = 0;
    const cache = (gw as any).userCache;
    cache.findActiveUser = async () => { lookups++; return ADMIN; };

    for (let i = 0; i < 130; i++) {
        await gw.handleDirectJoin(client, { chatId: 'c1' });
    }

    // 120 events are allowed; the extra 10 are dropped before the DB is touched.
    assert.equal(lookups, 120, 'the flood is cut before liveIdentity, not after');
    assert.equal(client.disconnected, false, 'rate limiting drops frames, it does not kick the user');
});

test('the event limit is per user, so one noisy account cannot drown another', async () => {
    const gw = gatewayFor();
    const aTok = jwt.sign({ sub: 'u1', role: Role.ADMIN, tv: 0 });
    const bTok = jwt.sign({ sub: 'u2', role: Role.STUDENT, tv: 0 });
    const alice = socket('4.4.4.4', aTok);
    const bob = socket('5.5.5.5', bTok);
    await gw.handleConnection(alice);
    await gw.handleConnection(bob);

    for (let i = 0; i < 120; i++) await gw.handleDirectJoin(alice, { chatId: 'c1' });

    // Alice is now exhausted; Bob's first frame must still pass.
    let bobLookups = 0;
    const cache = (gw as any).userCache;
    cache.findActiveUser = async (id: string) => { if (id === 'u2') bobLookups++; return adminOrStudent(id); };
    await gw.handleDirectJoin(bob, { chatId: 'c1' });

    assert.equal(bobLookups, 1, "Bob's allowance is his own");
});
