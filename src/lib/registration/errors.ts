/**
 * Split out from actions.ts because a "use server" file may only export
 * async functions — a class export there is a Next.js build error.
 */
export class RegistrationError extends Error {}
