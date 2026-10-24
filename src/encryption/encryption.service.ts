import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Application-level AES-256-GCM encryption.
 * Key is derived from JWT_SECRET via SHA-256 so no extra environment
 * configuration is required. Messages are stored encrypted at rest and
 * decrypted only when served to an authenticated participant.
 */
@Injectable()
export class EncryptionService {
    private readonly ALGO = 'aes-256-gcm';
    private readonly PREFIX = 'enc:v1:';
    private readonly key: Buffer;
    private readonly unreadable = '[Encrypted]';

    constructor() {
        const secret = process.env.JWT_SECRET!;
        this.key = createHash('sha256').update(secret).digest();
    }

    encrypt(plaintext: string): string {
        const iv = randomBytes(12);
        const cipher = createCipheriv(this.ALGO, this.key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `${this.PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
    }

    decrypt(payload: string): string {
        // Legacy plaintext (pre-encryption rows) is passed through unchanged.
        if (!payload.startsWith(this.PREFIX)) return payload;
        const parts = payload.slice(this.PREFIX.length).split('.');
        if (parts.length !== 3) return payload;
        const [ivB64, tagB64, dataB64] = parts;
        const decipher = createDecipheriv(this.ALGO, this.key, Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(dataB64, 'base64')),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    }

    tryDecrypt(payload: string): string {
        try {
            return this.decrypt(payload);
        } catch {
            return this.unreadable;
        }
    }
}
