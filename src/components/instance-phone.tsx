import { Copy, MessageCircle, Pencil, Check, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { Instance } from "@/types/evolution.types";
import { copyToClipboard } from "@/utils/copy-to-clipboard";
import { formatBrazilPhone, getInstanceLabel, setInstanceLabel } from "@/utils/phone";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

// Número da instância formatado, com copiar. Sem número, mostra o rótulo local (editável neste navegador).
export function InstancePhone({ instance, className, compact = false }: { instance: Instance; className?: string; compact?: boolean }) {
  const formatted = formatBrazilPhone(instance.ownerJid || instance.number);
  const [label, setLabel] = useState(() => getInstanceLabel(instance.id));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  const save = () => {
    setInstanceLabel(instance.id, draft);
    setLabel(getInstanceLabel(instance.id));
    setEditing(false);
  };

  if (formatted) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm", className)}>
        <MessageCircle size={compact ? 14 : 16} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <span className="truncate tabular-nums" title="Número do WhatsApp">
          {formatted}
        </span>
        <Button variant="ghost" size="icon" className={cn("shrink-0", compact ? "h-6 w-6" : "h-7 w-7")} onClick={() => copyToClipboard(formatted)} aria-label="Copiar número">
          <Copy size={compact ? 13 : 15} />
        </Button>
      </span>
    );
  }

  if (editing) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
        <Input className="h-8 w-44 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Rótulo" aria-label="Rótulo deste navegador" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={save} aria-label="Salvar rótulo">
          <Check size={15} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)} aria-label="Cancelar">
          <X size={15} />
        </Button>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground", className)} title="Sem número conectado. Rótulo salvo só neste navegador.">
      <MessageCircle size={compact ? 14 : 16} className="shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      <span className="shrink-0 text-[11px] uppercase tracking-wide">rótulo</span>
      <Button
        variant="ghost"
        size="icon"
        className={cn("shrink-0", compact ? "h-6 w-6" : "h-7 w-7")}
        onClick={() => {
          setDraft(label);
          setEditing(true);
        }}
        aria-label="Editar rótulo">
        <Pencil size={compact ? 13 : 15} />
      </Button>
    </span>
  );
}
