import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { UserCacheService } from '../common/user-cache.service';
import { InMemoryRateLimiter } from '../common/in-memory-rate-limiter';
import { getFrontendUrl } from '../common/frontend-url';

@WebSocketGateway({ cors: { origin: getFrontendUrl() } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
    constructor(
        private readonly jwtService: JwtService,
        private readonly chatService: ChatService,
        private readonly userCache: UserCacheService,
    ) { }

@WebSocketServer()
server!: Server;

    /**
     * How often every open socket is re-checked against the account row.
     *
     * A socket is authenticated once, at connect, and then lives for as long as
     * the browser keeps it open -- hours, over a weekend. HTTP requests re-check
     * the account on every call, so a suspension takes effect immediately there;
     * without a sweep the same suspension would never reach an idle socket.
     * A minute bounds that window without turning the check into a hot path.
     */
    private static readonly SWEEP_INTERVAL_MS = 60_000;
    private sweeper: NodeJS.Timeout | null = null;

    /**
     * WebSocket frames bypass the HTTP throttler entirely, so `chat:join` in a
     * tight loop is uncounted. These two limiters cover the two reachable
     * floods: opening handshakes, and events on an established socket. Both are
     * in-process and therefore per replica -- see InMemoryRateLimiter -- which
     * is weaker than Redis but strictly stronger than no limit at all.
     */
    private readonly connectionLimiter = new InMemoryRateLimiter(30, 60_000); // per IP
    private readonly eventLimiter = new InMemoryRateLimiter(120, 60_000); // per user

    /**
     * Authenticate the socket.
     *
     * A token signature proves the token was issued by us and has not expired.
     * It does NOT prove the account is still allowed to act: it says nothing
     * about a suspension, and its `role` claim is frozen at issue time.
     *
     * That matters here more than anywhere else, because isOversight() grants
     * ADMIN and COURSE_MANAGER blanket access to EVERY direct chat on the
     * platform. Reading the role straight off the token meant that demoting or
     * suspending an account did not touch chat at all -- the stale claim kept
     * working for the rest of the token's life, and revoking the session did not
     * close an already-open socket.
     *
     * So the role is taken from the database, exactly like the HTTP path does
     * via JwtStrategy. A suspended or demoted user is disconnected here.
     */
    async handleConnection(client: Socket) {
        try {
            // Counted before the token is even looked at, so a handshake flood
            // costs a map lookup rather than a JWT verify and a database read.
            if (!this.connectionLimiter.allow(this.clientIp(client))) {
                client.disconnect(true);
                return;
            }

            const token = client.handshake.auth?.token;
            if (!token) {
                client.disconnect();
                return;
            }
            const payload = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET!,
                // Pin the algorithm. Without this, verification accepts whatever
                // the token's own header asks for.
                algorithms: ['HS256'],
            });
            if (!payload?.sub) {
                client.disconnect();
                return;
            }
            // Same rule as the HTTP path (JwtStrategy): the 2FA challenge, the
            // forced password change and the operations grant are signed with
            // this secret for other purposes. They carry no `tv`, which reads
            // as 0 and would match an account whose tokenVersion never moved,
            // so without this check a challenge token could open a socket as
            // the user it was issued to verify.
            if (payload.purpose || payload.opsGrant === true) {
                client.disconnect();
                return;
            }

            const user = await this.userCache.findActiveUser(payload.sub);
            if (!user) {
                client.disconnect();
                return;
            }

            // From the database, not the token.
            (client as any).userId = user.id;
            (client as any).userRole = user.role;
            // Remember which token version opened this socket, so a later
            // logout/password change is detectable even though the socket never
            // re-authenticates on its own.
            (client as any).tokenVersion = typeof payload.tv === 'number' ? payload.tv : 0;

            this.ensureSweeper();
        } catch (err) {
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        // optional: leave all rooms on disconnect
    }

    onModuleDestroy() {
        if (this.sweeper) {
            clearInterval(this.sweeper);
            this.sweeper = null;
        }
    }

    /**
     * Resolve the socket's *current* identity, or drop it.
     *
     * Called before every privileged action so a role change or a revocation
     * that lands between sweeps is still honoured at the moment it matters. The
     * role returned here is what authorization uses -- never the copy stored at
     * connect time.
     */
    private async liveIdentity(client: Socket): Promise<{ id: string; role: string } | null> {
        const userId = (client as any).userId;
        if (!userId) return null;

        const user = await this.userCache.findActiveUser(userId);
        if (!user) {
            // Suspended or deleted since connecting.
            client.disconnect(true);
            return null;
        }
        if (((client as any).tokenVersion ?? 0) !== user.tokenVersion) {
            // Logged out, password changed, or a refresh token was replayed.
            client.disconnect(true);
            return null;
        }

        // Keep the cached copy in step so a sweep and an event agree.
        (client as any).userRole = user.role;
        return { id: user.id, role: user.role };
    }

    /** The caller's address, preferring the proxy's forwarded value. Behind
     *  Railway the socket address is the proxy, so every user would share one
     *  bucket if we did not read the header. */
    private clientIp(client: Socket): string {
        const forwarded = client.handshake.headers?.['x-forwarded-for'];
        const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        if (first) return String(first).split(',')[0].trim();
        return client.handshake.address || 'unknown';
    }

    /** Start the sweep once, on the first successful connection (this.server is
     *  guaranteed to exist by then, which is not true in onModuleInit). */
    private ensureSweeper(): void {
        if (this.sweeper) return;
        this.sweeper = setInterval(() => {
            void this.sweepSessions();
        }, ChatGateway.SWEEP_INTERVAL_MS);
        // Never let the sweeper alone keep the process alive.
        if (typeof this.sweeper.unref === 'function') this.sweeper.unref();
    }

    private async sweepSessions(): Promise<void> {
        try {
            // The interval is also a good time to shed elapsed rate-limit keys,
            // so an idle caller's bucket does not sit in memory forever.
            this.connectionLimiter.prune();
            this.eventLimiter.prune();

            const sockets = this.server?.sockets?.sockets;
            if (!sockets) return;

            // Group by user: several tabs are one account to re-check, not
            // several, so a user with ten tabs costs one lookup, not ten.
            const byUser = new Map<string, Socket[]>();
            for (const client of sockets.values()) {
                const userId = (client as any).userId;
                if (!userId) continue;
                const list = byUser.get(userId) ?? [];
                list.push(client);
                byUser.set(userId, list);
            }

            await Promise.all(
                [...byUser.entries()].map(async ([userId, clients]) => {
                    const user = await this.userCache.findActiveUser(userId);
                    if (!user) {
                        for (const client of clients) client.disconnect(true);
                        return;
                    }
                    for (const client of clients) {
                        if (((client as any).tokenVersion ?? 0) !== user.tokenVersion) {
                            client.disconnect(true);
                            continue;
                        }
                        // A demotion takes effect on the open socket too, so
                        // direct-chat access is re-evaluated with the new role.
                        (client as any).userRole = user.role;
                    }
                }),
            );
        } catch {
            // A sweep failure must never take the gateway down; the next tick
            // retries, and per-event liveIdentity still guards every action.
        }
    }

    @SubscribeMessage('chat:join')
    async handleJoin(client: Socket, payload: { roomId: string }) {
        try {
            // Rate-limit on the known userId before liveIdentity(), so a flood is
            // stopped before it turns into a database read per frame.
            const userId = (client as any).userId;
            if (!userId || !this.eventLimiter.allow(userId)) return;

            const identity = await this.liveIdentity(client);
            if (!identity || !payload?.roomId) return;
            const hasAccess = await this.chatService.userHasRoomAccess(payload.roomId, identity.id);
            if (hasAccess) {
                await client.join(payload.roomId);
            }
        } catch (err) {
            // ignore join errors
        }
    }

    @SubscribeMessage('direct:join')
    async handleDirectJoin(client: Socket, payload: { chatId: string }) {
        try {
            const userId = (client as any).userId;
            if (!userId || !this.eventLimiter.allow(userId)) return;

            const identity = await this.liveIdentity(client);
            if (!identity || !payload?.chatId) return;
            const hasAccess = await this.chatService.userHasDirectAccess(payload.chatId, identity.id, identity.role as any);
            if (hasAccess) {
                await client.join(`direct:${payload.chatId}`);
            }
        } catch (err) {
            // ignore join errors
        }
    }

    // Helper: emit a message to a room (called from service or controller)
    emitMessage(roomId: string, payload: any) {
        this.server.to(roomId).emit('chat:message', payload);
    }

    // Helper: emit a direct message to a direct chat channel (called from controller)
    emitDirectMessage(chatId: string, payload: any) {
        this.server.to(`direct:${chatId}`).emit('direct:message', payload);
    }
}