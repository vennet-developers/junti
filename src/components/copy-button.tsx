"use client";

import { useEffect, useState } from "react";

import { Button } from "@stackmyth/button";
import { CheckIcon, CopyIcon } from "@stackmyth/icons";

import { copy as strings } from "@/config/copy";

export interface CopyButtonProps {
  value: string;
  label: string;
  fullWidth?: boolean;
}

/**
 * One-tap copy, with the confirmation the user needs on a phone where nothing
 * else signals that the clipboard changed.
 */
export function CopyButton({ value, label, fullWidth }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      // navigator.clipboard is unavailable on http:// origins other than
      // localhost, which is exactly where somebody testing on a phone over the
      // LAN will be. Fall back to selecting the text for a manual copy.
      await navigator.clipboard.writeText(value);
      setFailed(false);
      setCopied(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <Button
      type="button"
      variant={copied ? "success" : "secondary"}
      size="md"
      fullWidth={fullWidth}
      onClick={handleCopy}
      aria-live="polite"
    >
      {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      {copied ? strings.common.copied : failed ? strings.common.unknownError : label}
    </Button>
  );
}
