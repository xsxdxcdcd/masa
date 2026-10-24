export function getFrontendUrl(): string {
    const raw = (process.env.FRONTEND_URL || '').trim();
    if (!raw) {
        return 'http://localhost:3000';
    }
    return raw.replace(/^(?!https?:\/\/)/, 'https://');
}