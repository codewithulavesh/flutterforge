import { cn } from '@/utils/cn';

/**
 * The single source of truth for the FlutterForge mark.
 * The source asset is 512x512 and is also the Electron app icon.
 */
export function BrandLogo({
  size = 32,
  className,
  alt = 'FlutterForge',
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/app-logo.png"
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      className={cn('rounded-[22%] object-cover shrink-0 select-none', className)}
    />
  );
}
