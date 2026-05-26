/**
 * Tiny class-name joiner. Avoids pulling clsx as a dep for this small package.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
    return parts.filter(Boolean).join(" ");
}
