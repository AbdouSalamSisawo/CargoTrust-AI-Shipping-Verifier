export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');

export const fmt = (n: number): string => n.toLocaleString('en-US');

