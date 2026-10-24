// Global bus that lets the axios layer ask for a fresh two-factor (step-up)
// code WITHOUT importing React or the modal. The api.ts response interceptor
// calls requestStepUpCode() on a 403 { stepUpRequired: true } and retries the
// request with the code as X-Step-Up-Code. StepUpProvider subscribes here.
export type StepUpResolver = (code: string | null) => void;
type StepUpHandler = (resolve: StepUpResolver) => void;

let handler: StepUpHandler | null = null;
let pending: Promise<string | null> | null = null;

export function setStepUpHandler(next: StepUpHandler | null) {
    handler = next;
    // A provider that mounts/unmounts must not strand a pending request.
    if (!next && pending) {
        pending = null;
    }
}

// Ask the mounted provider for an authenticator code. Resolves null when no
// provider is mounted (e.g. server-side or during static rendering) or when a
// prompt is already open (fail fast instead of stacking modals).
export function requestStepUpCode(): Promise<string | null> {
    if (!handler || pending) return Promise.resolve(null);
    pending = new Promise<string | null>((settle) => {
        handler!((code) => settle(code));
    }).finally(() => {
        pending = null;
    });
    return pending;
}