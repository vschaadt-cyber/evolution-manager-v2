import { CircleUser, DatabaseBackup, ExternalLink, LayoutGrid, List, MessageCircle, Plug, PlugZap, RefreshCw, Search, Server, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import { InstanceStatus } from "@/components/instance-status";
import { InstanceToken } from "@/components/instance-token";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TooltipWrapper } from "@/components/ui/tooltip";

import { useFetchInstances } from "@/lib/queries/instance/fetchInstances";
import { useManageInstance } from "@/lib/queries/instance/manageInstance";
import { cn } from "@/lib/utils";

import { Instance } from "@/types/evolution.types";

import { NewInstance } from "./NewInstance";

const fmt = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const VIEW_KEY = "gestao-instances-view";

type StatusFilter = "all" | "open" | "connecting" | "close";

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Server; label: string; value: string; tone: string }) {
  return (
    <Card className="flex-row items-center gap-4 p-4">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold leading-tight">{value}</p>
      </div>
    </Card>
  );
}

function InstanceAvatar({ instance, size = "h-10 w-10" }: { instance: Instance; size?: string }) {
  return (
    <Avatar className={size}>
      <AvatarImage src={instance.profilePicUrl} alt="" />
      <AvatarFallback className="bg-accent text-sm font-semibold text-accent-foreground">{instance.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function InstanceActions({ instance, onDelete, deleting }: { instance: Instance; onDelete: (name: string) => void; deleting: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-end gap-1">
      <TooltipWrapper content={t("dashboard.open")} side="top">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/manager/instance/${instance.id}/dashboard`}>
            <ExternalLink size={17} />
          </Link>
        </Button>
      </TooltipWrapper>
      <TooltipWrapper content={t("dashboard.backup")} side="top">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/manager/backup?instance=${encodeURIComponent(instance.name)}`}>
            <DatabaseBackup size={17} />
          </Link>
        </Button>
      </TooltipWrapper>
      <TooltipWrapper content={t("button.delete")} side="top">
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(instance.name)} disabled={deleting}>
          <Trash2 size={17} />
        </Button>
      </TooltipWrapper>
    </div>
  );
}

function Dashboard() {
  const { t } = useTranslation();

  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const { deleteInstance, logout } = useManageInstance();
  const { data: instances, refetch, isFetching } = useFetchInstances();
  const [deleting, setDeleting] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [nameSearch, setNameSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">(() => (localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list"));

  const changeView = (next: "list" | "grid") => {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  const resetTable = async () => {
    await refetch();
  };

  const handleDelete = async (instanceName: string) => {
    setDeleteConfirmation(null);
    setDeleting((old) => [...old, instanceName]);
    try {
      try {
        await logout(instanceName);
      } catch (error) {
        console.error("Error logout:", error);
      }
      await deleteInstance(instanceName);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      resetTable();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error instance delete:", error);
      toast.error(`Error : ${error?.response?.data?.response?.message}`);
    } finally {
      setDeleting((old) => old.filter((item) => item !== instanceName));
    }
  };

  const list = useMemo(() => (Array.isArray(instances) ? instances : []), [instances]);

  const stats = useMemo(() => {
    const isClosed = (status: string) => status === "close" || status === "closed";
    return {
      total: list.length,
      open: list.filter((item) => item.connectionStatus === "open").length,
      connecting: list.filter((item) => item.connectionStatus === "connecting").length,
      closed: list.filter((item) => isClosed(item.connectionStatus)).length,
      messages: list.reduce((sum, item) => sum + (item._count?.Message ?? 0), 0),
      contacts: list.reduce((sum, item) => sum + (item._count?.Contact ?? 0), 0),
    };
  }, [list]);

  const filteredInstances = useMemo(() => {
    let result = [...list];
    if (statusFilter !== "all") {
      result = result.filter((item) => (statusFilter === "close" ? item.connectionStatus === "close" || item.connectionStatus === "closed" : item.connectionStatus === statusFilter));
    }
    const term = nameSearch.trim().toLowerCase();
    if (term) {
      result = result.filter((item) => item.name.toLowerCase().includes(term) || item.profileName?.toLowerCase().includes(term) || item.ownerJid?.includes(term));
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [list, nameSearch, statusFilter]);

  const filters: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: t("status.all"), count: stats.total },
    { value: "open", label: t("status.open"), count: stats.open },
    { value: "connecting", label: t("status.connecting"), count: stats.connecting },
    { value: "close", label: t("status.closed"), count: stats.closed },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Server} label={t("dashboard.stats.total")} value={fmt(stats.total)} tone="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" />
        <StatCard icon={Plug} label={t("dashboard.stats.connected")} value={fmt(stats.open)} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" />
        <StatCard icon={PlugZap} label={t("dashboard.stats.disconnected")} value={fmt(stats.closed)} tone="bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300" />
        <StatCard icon={MessageCircle} label={t("dashboard.stats.messages")} value={fmt(stats.messages)} tone="bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300" />
        <StatCard icon={CircleUser} label={t("dashboard.stats.contacts")} value={fmt(stats.contacts)} tone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", statusFilter === filter.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {filter.label} <span className="ml-1 text-xs opacity-70">{filter.count}</span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("dashboard.search")} value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} />
          </div>

          <div className="flex gap-1 rounded-lg border p-1">
            <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => changeView("list")} aria-label={t("dashboard.viewList")}>
              <List size={17} />
            </Button>
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => changeView("grid")} aria-label={t("dashboard.viewGrid")}>
              <LayoutGrid size={17} />
            </Button>
          </div>

          <Button variant="outline" size="icon" onClick={resetTable} aria-label={t("dashboard.refresh")}>
            <RefreshCw size={18} className={cn(isFetching && "animate-spin")} />
          </Button>
          <NewInstance resetTable={resetTable} />
        </div>
      </Card>

      {filteredInstances.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">{t("dashboard.instancesNotFound")}</p>}

      {filteredInstances.length > 0 && view === "list" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">{t("dashboard.table.name")}</th>
                  <th className="px-4 py-3 font-semibold">{t("dashboard.table.status")}</th>
                  <th className="px-4 py-3 font-semibold">{t("dashboard.table.number")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("dashboard.table.messages")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("dashboard.table.contacts")}</th>
                  <th className="px-4 py-3 font-semibold">{t("dashboard.table.token")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredInstances.map((instance) => (
                  <tr key={instance.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link to={`/manager/instance/${instance.id}/dashboard`} className="flex items-center gap-3">
                        <InstanceAvatar instance={instance} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{instance.name}</span>
                          {instance.profileName && <span className="block truncate text-xs text-muted-foreground">{instance.profileName}</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <InstanceStatus status={instance.connectionStatus} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{instance.ownerJid ? instance.ownerJid.split("@")[0] : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(instance._count?.Message ?? 0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(instance._count?.Contact ?? 0)}</td>
                    <td className="px-4 py-3">
                      <InstanceToken token={instance.token} className="w-44" />
                    </td>
                    <td className="px-4 py-3">
                      <InstanceActions instance={instance} onDelete={setDeleteConfirmation} deleting={deleting.includes(instance.name)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filteredInstances.length > 0 && view === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredInstances.map((instance) => (
            <Card key={instance.id} className="flex min-w-0 flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/manager/instance/${instance.id}/dashboard`} className="flex min-w-0 items-center gap-3">
                  <InstanceAvatar instance={instance} size="h-12 w-12" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{instance.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{instance.profileName || (instance.ownerJid ? instance.ownerJid.split("@")[0] : "—")}</span>
                  </span>
                </Link>
                <InstanceStatus status={instance.connectionStatus} />
              </div>

              <InstanceToken token={instance.token} />

              <div className="flex items-center justify-between border-t pt-3">
                <div className="flex gap-5 text-sm">
                  <span className="flex items-center gap-1.5" title={t("dashboard.table.messages")}>
                    <MessageCircle size={16} className="text-muted-foreground" />
                    {fmt(instance._count?.Message ?? 0)}
                  </span>
                  <span className="flex items-center gap-1.5" title={t("dashboard.table.contacts")}>
                    <CircleUser size={16} className="text-muted-foreground" />
                    {fmt(instance._count?.Contact ?? 0)}
                  </span>
                </div>
                <InstanceActions instance={instance} onDelete={setDeleteConfirmation} deleting={deleting.includes(instance.name)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!!deleteConfirmation && (
        <Dialog onOpenChange={() => setDeleteConfirmation(null)} open>
          <DialogContent>
            <DialogClose />
            <DialogHeader>{t("modal.delete.title")}</DialogHeader>
            <p>{t("modal.delete.message", { instanceName: deleteConfirmation })}</p>
            <DialogFooter>
              <div className="flex items-center gap-4">
                <Button onClick={() => setDeleteConfirmation(null)} size="sm" variant="outline">
                  {t("button.cancel")}
                </Button>
                <Button onClick={() => handleDelete(deleteConfirmation)} variant="destructive">
                  {t("button.delete")}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default Dashboard;
