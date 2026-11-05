"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/utils/cn";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-9 w-16 shrink-0 cursor-pointer items-center rounded-full border border-[var(--fb-line)] bg-[var(--fb-soft)] p-[3px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fb-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fb-bg)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--fb-ink)] data-[state=unchecked]:bg-[var(--fb-soft)]",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-[26px] w-[26px] rounded-full border border-[var(--fb-line)] bg-[var(--fb-card)] shadow-[0_1px_3px_rgba(0,0,0,0.28)] transition-transform duration-300 data-[state=checked]:translate-x-[30px] data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
