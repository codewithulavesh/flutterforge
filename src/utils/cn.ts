import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class-name combiner used across the app.
 *
 * Accepts the same inputs as `clsx` plus Base UI's state-based className
 * functions (`(state) => string | undefined`). Those functions are resolved by
 * the primitive at render time; passing one through here would stringify it
 * into the class list, so they are ignored — callers that need state-driven
 * classes should pass them directly to the primitive instead.
 */
export function cn(...classes: (ClassValue | ((state: never) => string | undefined))[]): string {
  return twMerge(clsx(classes.map((value) => (typeof value === 'function' ? undefined : value))));
}
