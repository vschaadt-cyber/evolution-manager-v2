import { Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { copyToClipboard } from "@/utils/copy-to-clipboard";

import { Button } from "./ui/button";

export function InstanceToken({ token, className }: { token: string; className?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("flex min-w-0 items-center gap-3 overflow-hidden rounded-md bg-muted px-2 py-1", className)}>
      <pre className="block min-w-0 flex-1 truncate text-xs">{visible ? token : token?.replace(/\w/g, "*")}</pre>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          copyToClipboard(token);
        }}>
        <Copy size="15" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setVisible((old) => !old);
        }}>
        {visible ? <EyeOff size="15" /> : <Eye size="15" />}
      </Button>
    </div>
  );
}
