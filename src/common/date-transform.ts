/**
 * Normalises whatever a date input sends into a full ISO string, because Prisma
 * rejects the date-only value `<input type="date">` produces ("premature end of
 * input. Expected ISO-8601 DateTime").
 *
 * An unparsable value is passed through untouched on purpose: transforms run
 * BEFORE the validators, so calling toISOString() on garbage threw a RangeError
 * here and turned a bad request into a 500. Handing the raw value to
 * @IsDateString() instead reports it as the 400 it is.
 */
export const toIsoDate = ({ value }: { value: unknown }) => {
    if (!value) return value;
    const parsed = new Date(value as string);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
};