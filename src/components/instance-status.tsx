import { useTranslation } from "react-i18next";

import { Badge } from "./ui/badge";

import type { FaseReinicio } from "@/lib/reinicioInstancia";

/** Badge de estado da instância. Com `fase` de reinício em curso, mostra "Reiniciando…" no lugar do estado. */
export function InstanceStatus({ status, fase }: { status: string; fase?: FaseReinicio | null }) {
  const { t } = useTranslation();

  if (fase === "reiniciando" || fase === "iniciando") {
    return <Badge variant="warning">{t("instance.restart.badge", "Reiniciando…")}</Badge>;
  }
  if (fase === "sem_resposta") {
    return <Badge variant="destructive">{t("instance.restart.noResponse", "Sem resposta após o reinício")}</Badge>;
  }

  if (!status) {
    return null;
  }

  if (status === "open") return <Badge variant="success">{t("status.open")}</Badge>;

  if (status === "connecting") return <Badge variant="warning">{t("status.connecting")}</Badge>;

  if (status === "close" || status === "closed") return <Badge variant="destructive">{t("status.closed")}</Badge>;

  return <Badge variant="secondary">{status}</Badge>;
}
