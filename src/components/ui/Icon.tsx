/**
 * Lucide icon looked up by name at runtime, for icon names that come from data
 * (channel icons, agent kinds, step lists). Unknown names render a circle rather than crash.
 */
"use client";
import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = (Icons as unknown as Record<string, React.ComponentType<LucideProps>>)[name] ?? Icons.Circle;
  return <C {...props} />;
}
