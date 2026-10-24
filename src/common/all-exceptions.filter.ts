import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Single place where an error becomes an HTTP response.
 *
 * WITHOUT THIS: anything Nest does not recognise keeps its own shape. A
 * malformed body currently comes back as
 *
 *     {"message":"Expected property name or '}' in JSON at position 1"}
 *
 * which is V8's own JSON parser message, handed to an anonymous caller. It
 * confirms the runtime, it is useless to the person who made the request, and
 * it is the sort of detail an attacker probes for. Same story for the
 * body-parser 413 and for anything thrown by multer.
 *
 * The rules below, in order:
 *
 *   1. An HttpException is a decision the application made on purpose. Its
 *      message goes out unchanged -- including validation arrays, which the
 *      frontend reads as a list of field errors.
 *   2. Anything else with a 4xx status (body-parser, multer) keeps the status
 *      but loses the internal wording, because that wording is the library's,
 *      not ours.
 *   3. Everything else is a bug. The client gets a generic message and a
 *      request id; the detail goes to the log, where there are no strangers.
 *
 * The request id is the point of rule 3. A support answer to "it 500'd" needs
 * to be able to find the failure, and that must not require shipping stack
 * traces to the public to get it.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter');

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<Response>();
        const req = ctx.getRequest<Request>();

        const requestId =
            (req.headers['x-request-id'] as string | undefined) ?? randomUUID();

        if (res.headersSent) {
            // Something already started writing -- a streamed file, for example.
            // Rewriting the response here would corrupt it.
            this.logger.error(
                `error after headers sent requestId=${requestId} ${req.method} ${req.originalUrl}`,
            );
            return;
        }

        if (exception instanceof HttpException) {
            const status = exception.getStatus();

            // A 5xx is still a failure, even when it arrived dressed as an
            // HttpException. Code that throws
            // InternalServerErrorException('db password is hunter2') means well
            // but must not be believed: the class does not make the message
            // safe. Anything at or above 500 is generic plus a request id.
            if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
                this.logInternal(exception, req, requestId);
                res.status(status).json({
                    statusCode: status,
                    message: 'An unexpected error occurred',
                    error: 'Internal Server Error',
                    requestId,
                });
                return;
            }

            // Below 500 the application decided, on purpose, what to tell the
            // caller. Keep the message verbatim -- including validation arrays,
            // which the frontend iterates over.
            const body = exception.getResponse();
            res.status(status).json(this.withRequestId(body, requestId));
            return;
        }

        // Not an HttpException. Some libraries (body-parser, multer) attach a
        // status to a plain Error, so treat a genuine 4xx as the caller's fault
        // rather than as an internal failure.
        const attached = (exception as { status?: number; statusCode?: number }) ?? {};
        const candidate = Number(attached.status ?? attached.statusCode);
        const isClientError = Number.isInteger(candidate) && candidate >= 400 && candidate < 500;

        if (isClientError) {
            res.status(candidate).json({
                statusCode: candidate,
                message: 'Request could not be processed',
                error: 'Bad Request',
                requestId,
            });
            return;
        }

        // A genuine 500. Log everything, tell the caller nothing.
        this.logInternal(exception, req, requestId);

        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'An unexpected error occurred',
            error: 'Internal Server Error',
            requestId,
        });
    }

    /**
     * Full detail goes to the log, where there are no strangers. Only the
     * exception's own name/message/stack -- never the request body, which is
     * where passwords live.
     */
    private logInternal(exception: unknown, req: Request, requestId: string) {
        this.logger.error(
            `unhandled exception requestId=${requestId} ${req.method} ${req.originalUrl} :: ${
                exception instanceof Error
                    ? `${exception.name}: ${exception.message}`
                    : String(exception)
            }`,
            exception instanceof Error ? exception.stack : undefined,
        );
    }

    private withRequestId(body: unknown, requestId: string) {
        if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
            return { ...(body as Record<string, unknown>), requestId };
        }
        return { message: body, requestId };
    }
}
