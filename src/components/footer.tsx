import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useVerifyServer } from "@/lib/queries/auth/verifyServer";
import { getToken, TOKEN_ID } from "@/lib/queries/token";

function Footer() {
  const { t } = useTranslation();

  const url = getToken(TOKEN_ID.API_URL);
  const { data: serverInfo } = useVerifyServer({ url });

  const clientName = useMemo(() => serverInfo?.clientName, [serverInfo]);
  const version = useMemo(() => serverInfo?.version, [serverInfo]);

  return (
    <footer className="flex w-full flex-col items-center justify-center p-6 text-xs text-secondary-foreground sm:flex-row">
      <div className="flex items-center space-x-3 divide-x">
        {clientName && clientName !== "" && (
          <span>
            {t("footer.clientName")}: <strong>{clientName}</strong>
          </span>
        )}
        {version && version !== "" && (
          <span className="pl-3">
            {t("footer.version")}: <strong>{version}</strong>
          </span>
        )}
      </div>
    </footer>
  );
}

export { Footer };
