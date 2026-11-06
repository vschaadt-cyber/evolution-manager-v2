/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { DatabaseBackup, Download, FileJson, FileSpreadsheet, Info, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { backupFileName, BackupFormat, BackupProgress, buildBackup, downloadBlob } from "@/lib/backup";
import { apiGlobal } from "@/lib/queries/api";
import { useFetchInstances } from "@/lib/queries/instance/fetchInstances";
import { cn } from "@/lib/utils";

type ChatItem = { id: string; remoteJid: string; name: string; isGroup: boolean };

const fmt = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-base">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Backup() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: instances } = useFetchInstances();

  const instanceName = searchParams.get("instance") ?? "";
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chatSearch, setChatSearch] = useState("");
  const [format, setFormat] = useState<BackupFormat>("jsonl");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [done, setDone] = useState<{ exported: number; fileName: string } | null>(null);
  const cancelRef = useRef({ cancelled: false });

  const instance = useMemo(() => instances?.find((item) => item.name === instanceName), [instances, instanceName]);

  // Ao trocar de instância, limpa a seleção.
  useEffect(() => {
    setSelected(new Set());
    setDone(null);
    setProgress(null);
  }, [instanceName]);

  const { data: chats, isFetching: loadingChats } = useQuery<ChatItem[]>({
    queryKey: ["backup", "chats", instanceName],
    enabled: !!instanceName && scope === "selected",
    queryFn: async () => {
      const response = await apiGlobal.post(`/chat/findChats/${instanceName}`, { where: {} });
      const list: any[] = Array.isArray(response.data) ? response.data : [];
      const seen = new Set<string>();
      return list
        .filter((chat) => chat?.remoteJid && !seen.has(chat.remoteJid) && seen.add(chat.remoteJid))
        .map((chat) => ({
          id: chat.id ?? chat.remoteJid,
          remoteJid: chat.remoteJid as string,
          name: chat.pushName || chat.name || (chat.remoteJid as string).split("@")[0],
          isGroup: (chat.remoteJid as string).endsWith("@g.us"),
        }));
    },
  });

  const visibleChats = useMemo(() => {
    const term = chatSearch.trim().toLowerCase();
    if (!chats) return [];
    if (!term) return chats;
    return chats.filter((chat) => chat.name.toLowerCase().includes(term) || chat.remoteJid.toLowerCase().includes(term));
  }, [chats, chatSearch]);

  const toggleChat = (jid: string) =>
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });

  const selectAllVisible = () =>
    setSelected((old) => {
      const next = new Set(old);
      visibleChats.forEach((chat) => next.add(chat.remoteJid));
      return next;
    });

  const canRun = !!instanceName && !running && (scope === "all" || selected.size > 0);

  const run = async () => {
    cancelRef.current = { cancelled: false };
    setRunning(true);
    setDone(null);
    setProgress({ exported: 0, total: null });

    try {
      const result = await buildBackup({
        instanceName,
        remoteJids: scope === "selected" ? Array.from(selected) : undefined,
        format,
        onProgress: setProgress,
        signal: cancelRef.current,
      });

      if (!result.blob) {
        toast.info(t("backup.cancelled"));
        return;
      }

      const fileName = backupFileName(instanceName, format);
      downloadBlob(result.blob, fileName);
      setDone({ exported: result.exported, fileName });
      toast.success(t("backup.success", { count: result.exported }));
    } catch (error: any) {
      console.error("Backup error:", error);
      toast.error(`${t("backup.error")}: ${error?.response?.data?.message ?? error?.message ?? ""}`);
    } finally {
      setRunning(false);
    }
  };

  const percent = progress?.total ? Math.min(100, Math.round((progress.exported / progress.total) * 100)) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Step number={1} title={t("backup.step.instance")}>
        <Select value={instanceName} onValueChange={(value) => setSearchParams({ instance: value })}>
          <SelectTrigger>
            <SelectValue placeholder={t("backup.selectInstance")} />
          </SelectTrigger>
          <SelectContent>
            {instances?.map((item) => (
              <SelectItem key={item.id} value={item.name}>
                {item.name}
                {item.profileName ? ` · ${item.profileName}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {instance && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("backup.instanceSummary", { messages: fmt(instance._count?.Message ?? 0), contacts: fmt(instance._count?.Contact ?? 0) })}
          </p>
        )}
      </Step>

      <Step number={2} title={t("backup.step.scope")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["all", "selected"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              className={cn("rounded-lg border p-3 text-left transition-colors", scope === value ? "border-primary bg-accent" : "hover:bg-muted")}>
              <p className="text-sm font-medium">{t(`backup.scope.${value}.title`)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t(`backup.scope.${value}.description`)}</p>
            </button>
          ))}
        </div>

        {scope === "selected" && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder={t("backup.searchChat")} value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} />
              </div>
              <Button variant="outline" size="sm" onClick={selectAllVisible} disabled={visibleChats.length === 0}>
                {t("button.markAll")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                {t("button.unMarkAll")}
              </Button>
            </div>

            <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
              {!instanceName && <p className="p-4 text-sm text-muted-foreground">{t("backup.selectInstanceFirst")}</p>}
              {loadingChats && (
                <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" /> {t("backup.loadingChats")}
                </p>
              )}
              {instanceName && !loadingChats && visibleChats.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("backup.noChats")}</p>}
              {visibleChats.map((chat) => (
                <label key={chat.remoteJid} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted">
                  <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={selected.has(chat.remoteJid)} onChange={() => toggleChat(chat.remoteJid)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{chat.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{chat.remoteJid.split("@")[0]}</span>
                  </span>
                  {chat.isGroup && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t("backup.group")}</span>}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("backup.selectedCount", { count: selected.size })}</p>
          </div>
        )}
      </Step>

      <Step number={3} title={t("backup.step.format")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: "jsonl", icon: FileJson },
              { value: "csv", icon: FileSpreadsheet },
            ] as const
          ).map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormat(value)}
              className={cn("flex items-start gap-3 rounded-lg border p-3 text-left transition-colors", format === value ? "border-primary bg-accent" : "hover:bg-muted")}>
              <Icon size={20} className="mt-0.5 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium">{t(`backup.format.${value}.title`)}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{t(`backup.format.${value}.description`)}</span>
              </span>
            </button>
          ))}
        </div>
      </Step>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={!canRun} className="gap-2">
              {running ? <Loader2 size={18} className="animate-spin" /> : <DatabaseBackup size={18} />}
              {running ? t("backup.running") : t("backup.start")}
            </Button>
            {running && (
              <Button
                variant="outline"
                onClick={() => {
                  cancelRef.current.cancelled = true;
                }}>
                {t("button.cancel")}
              </Button>
            )}
          </div>

          {progress && (running || done) && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full bg-primary transition-all", percent === null && running && "animate-pulse")} style={{ width: `${percent ?? (done ? 100 : 40)}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">
                {fmt(progress.exported)} {progress.total ? `/ ${fmt(progress.total)}` : ""} {t("backup.messages")}
                {percent !== null ? ` (${percent}%)` : ""}
              </p>
            </div>
          )}

          {done && (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <Download size={16} /> {t("backup.done", { amount: fmt(done.exported), fileName: done.fileName })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed bg-transparent shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info size={16} className="text-muted-foreground" /> {t("backup.noteTitle")}
          </CardTitle>
          <CardDescription>{t("backup.note")}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export { Backup };
