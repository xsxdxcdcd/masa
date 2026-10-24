import type { NextFunction, Request, Response } from 'express';

/**
 * Runs BEFORE AllExceptionsFilter ever sees a body-parser failure.
 *
 * Why this exists: body-parser does not hand Nest a foreign error. Express
 * catches the SyntaxError and Nest's own layer re-wraps it as a
 * BadRequestException, so by the time the exception filter runs there is
 * nothing left to tell "the application chose this message" apart from "V8's
 * JSON parser said this". Production was answering anonymous callers with
 *
 *     {"message":"Expected property name or '}' in JSON at position 1"}
 *
 * The filter cannot fix that on its own, so the diagnosis happens here, while
 * the library still identifies itself.
 *
 * The status code is preserved: a client sending 12MB deserves the same 413 it
 * got before, just without the library's wording. Only the message changes.
 */
export function bodyParserErrorHandler(
    err: any,
    _req: Request,
    res: Response,
    next: NextFunction,
): void {
    const type = err?.type;

    if (type === 'entity.parse.failed' || type === 'entity.too.large' || type === 'encoding.unsupported') {
        const status = Number(err.status ?? err.statusCode) || 400;
        res.status(status).json({
            statusCode: status,
            message: type === 'entity.too.large'
                ? 'Request body is too large'
                : 'Request body could not be parsed',
            error: 'Bad Request',
        });
        return;
    }

    // Not a parser complaint -- let the normal chain handle it, including the
    // exception filter's 500 path.
    next(err);
}
