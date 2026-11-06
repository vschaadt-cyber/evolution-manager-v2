/* eslint-disable react-hooks/exhaustive-deps */
import { CircleUser, Link2Off, MessageCircle, Power, QrCode, RefreshCw, Smartphone, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "react-qr-code";

import { InstancePhone } from "@/components/instance-phone";
import { InstanceStatus } from "@/components/instance-status";
import { InstanceToken } from "@/components/instance-token";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useInstance } from "@/contexts/InstanceContext";

import { useManageInstance } from "@/lib/queries/instance/manageInstance";
import { getToken, TOKEN_ID } from "@/lib/queries/token";

function StatCard({ icon: Icon, label, value }: { icon: typeof CircleUser; label: string; value: string }) {
  return (
    <Card className="flex-row items-center gap-4 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold leading-tight">{value}</p>
      </div>
    </Card>
  );
}

function DashboardInstance() {
  const { t, i18n } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(i18n.language);
  const [qrCode, setQRCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState<"restart" | "logout" | null>(null);
  const token = getToken(TOKEN_ID.TOKEN);

  const { connect, logout, restart } = useManageInstance();
  const { instance, reloadInstance } = useInstance();

  useEffect(() => {
    if (instance) {
      localStorage.setItem(TOKEN_ID.INSTANCE_ID, instance.id);
      localStorage.setItem(TOKEN_ID.INSTANCE_NAME, instance.name);
      localStorage.setItem(TOKEN_ID.INSTANCE_TOKEN, instance.token);
    }
  }, [instance]);

  const isOpen = instance?.connectionStatus === "open";
  const showingCode = !!qrCode || !!pairingCode;

  // Enquanto o QR Code está na tela, confere a conexão a cada 4s e fecha o QR quando conectar.
  useEffect(() => {
    if (!showingCode) return;
    const timer = setInterval(() => reloadInstance(), 4000);
    return () => clearInterval(timer);
  }, [showingCode]);

  useEffect(() => {
    if (isOpen && showingCode) {
      setQRCode(null);
      setPairingCode("");
    }
  }, [isOpen]);

  const handleConnect = async (usePairingCode: boolean) => {
    if (!instance || !token) return;
    try {
      setConnecting(true);
      setQRCode(null);
      setPairingCode("");

      if (usePairingCode) {
        const data = await connect({ instanceName: instance.name, token, number: instance.number });
        setPairingCode(data.pairingCode);
      } else {
        const data = await connect({ instanceName: instance.name, token });
        setQRCode(data.code);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setConnecting(false);
    }
  };

  const handleRestart = async () => {
    if (!instance) return;
    try {
      setBusy("restart");
      await restart(instance.name);
      await reloadInstance();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setBusy(null);
    }
  };

  const handleLogout = async () => {
    if (!instance) return;
    try {
      setBusy("logout");
      await logout(instance.name);
      await reloadInstance();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setBusy(null);
    }
  };

  const stats = useMemo(
    () => ({
      contacts: instance?._count?.Contact || 0,
      chats: instance?._count?.Chat || 0,
      messages: instance?._count?.Message || 0,
    }),
    [instance],
  );

  if (!instance) {
    return <LoadingSpinner />;
  }

  const steps = [t("instance.dashboard.steps.1"), t("instance.dashboard.steps.2"), t("instance.dashboard.steps.3"), t("instance.dashboard.steps.4")];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={CircleUser} label={t("instance.dashboard.contacts")} value={numberFormatter.format(stats.contacts)} />
        <StatCard icon={UsersRound} label={t("instance.dashboard.chats")} value={numberFormatter.format(stats.chats)} />
        <StatCard icon={MessageCircle} label={t("instance.dashboard.messages")} value={numberFormatter.format(stats.messages)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("instance.dashboard.account")}</CardTitle>
            <CardDescription>{t("instance.dashboard.accountDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={instance.profilePicUrl} alt="" />
                <AvatarFallback className="bg-accent font-semibold text-accent-foreground">{instance.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{instance.profileName || instance.name}</p>
                <div className="min-w-0 text-sm text-muted-foreground">
                  <InstancePhone instance={instance} />
                </div>
              </div>
              <InstanceStatus status={instance.connectionStatus} />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t("instance.dashboard.token")}</p>
              <InstanceToken token={instance.token} />
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => reloadInstance()}>
                <RefreshCw size={16} /> {t("instance.dashboard.refresh")}
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleRestart} disabled={busy !== null}>
                <Power size={16} /> {t("instance.dashboard.button.restart")}
              </Button>
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleLogout} disabled={busy !== null || instance.connectionStatus === "close"}>
                <Link2Off size={16} /> {t("instance.dashboard.button.disconnect")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t("instance.dashboard.connection")}</CardTitle>
            <CardDescription>{isOpen ? t("instance.dashboard.connectedDescription") : t("instance.dashboard.alert")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isOpen ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <Smartphone size={24} />
                </span>
                <p className="font-medium">{t("instance.dashboard.connectedTitle")}</p>
                <p className="max-w-sm text-sm text-muted-foreground">{t("instance.dashboard.connectedHint")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ol className="space-y-3 text-sm">
                  {steps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                  <li className="flex flex-wrap gap-2 pt-2">
                    <Button className="gap-2" onClick={() => handleConnect(false)} disabled={connecting}>
                      <QrCode size={16} /> {qrCode ? t("instance.dashboard.newQr") : t("instance.dashboard.button.qrcode.label")}
                    </Button>
                    {instance.number && (
                      <Button variant="outline" onClick={() => handleConnect(true)} disabled={connecting}>
                        {t("instance.dashboard.button.pairingCode.label")}
                      </Button>
                    )}
                  </li>
                </ol>

                <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-lg border bg-white p-4 text-black">
                  {connecting && <LoadingSpinner />}
                  {!connecting && qrCode && (
                    <>
                      <QRCode value={qrCode} size={224} bgColor="#ffffff" fgColor="#000000" />
                      <p className="text-center text-xs text-neutral-500">{t("instance.dashboard.qrExpires")}</p>
                    </>
                  )}
                  {!connecting && pairingCode && (
                    <div className="text-center">
                      <p className="text-sm font-medium">{t("instance.dashboard.button.pairingCode.title")}</p>
                      <p className="mt-2 text-3xl font-bold tracking-widest">
                        {pairingCode.substring(0, 4)}-{pairingCode.substring(4, 8)}
                      </p>
                    </div>
                  )}
                  {!connecting && !qrCode && !pairingCode && (
                    <div className="flex flex-col items-center gap-2 text-neutral-400">
                      <QrCode size={64} strokeWidth={1.2} />
                      <p className="text-center text-xs">{t("instance.dashboard.qrPlaceholder")}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export { DashboardInstance };
