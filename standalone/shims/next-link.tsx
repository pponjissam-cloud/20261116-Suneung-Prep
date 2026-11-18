import type { ReactNode } from "react";
import { toHash } from "./router";

/** next/link 대체 */
export default function Link({ href, className, children }: { href: string; className?: string; children?: ReactNode }) {
  return (
    <a href={toHash(href)} className={className}>
      {children}
    </a>
  );
}
