/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiGlobal } from "@/lib/queries/api";

export type BackupFormat = "jsonl" | "csv";

export type BackupProgress = {
  exported: number;
  total: number | null;
  currentChat?: string;
};

export type BackupOptions = {
  instanceName: string;
  /** Vazio = todas as mensagens da instância. */
  remoteJids?: string[];
  format: BackupFormat;
  onProgress?: (progress: BackupProgress) => void;
  signal?: { cancelled: boolean };
};

const PAGE_SIZE = 500;

const CSV_COLUMNS = ["instancia", "conversa", "id_mensagem", "enviada_por_mim", "nome", "data_hora", "tipo", "texto", "status"];

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
};

export const toIsoDate = (timestamp: unknown): string => {
  const raw = Number(timestamp);
  if (!raw) return "";
  const ms = raw < 1e12 ? raw * 1000 : raw;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

export const messageText = (message: any): string => {
  const content = message?.message;
  if (!content) return "";
  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.listResponseMessage?.title ||
    (message.messageType ? `[${message.messageType}]` : "")
  );
};

const toCsvRow = (instanceName: string, message: any) =>
  [
    instanceName,
    message?.key?.remoteJid,
    message?.key?.id,
    message?.key?.fromMe ? "sim" : "nao",
    message?.pushName,
    toIsoDate(message?.messageTimestamp),
    message?.messageType,
    messageText(message),
    message?.status,
  ]
    .map(csvCell)
    .join(",");

const fetchPage = async (instanceName: string, where: Record<string, unknown>, page: number) => {
  const response = await apiGlobal.post(`/chat/findMessages/${instanceName}`, { where, page, offset: PAGE_SIZE }, { timeout: 120000 });
  const data = response.data;
  const records: any[] = data?.messages?.records ?? (Array.isArray(data) ? data : []);
  const pages: number = data?.messages?.pages ?? 1;
  const total: number | null = typeof data?.messages?.total === "number" ? data.messages.total : null;
  return { records, pages, total };
};

/**
 * Baixa todas as mensagens (paginando de 500 em 500) e monta o arquivo no navegador.
 * Retorna o Blob e a quantidade de mensagens exportadas.
 */
export async function buildBackup({ instanceName, remoteJids, format, onProgress, signal }: BackupOptions) {
  const parts: BlobPart[] = [];
  if (format === "csv") parts.push("﻿" + CSV_COLUMNS.join(",") + "\n");

  const targets: (string | null)[] = remoteJids && remoteJids.length > 0 ? remoteJids : [null];
  let exported = 0;
  let total: number | null = null;

  for (const jid of targets) {
    const where = jid ? { key: { remoteJid: jid } } : {};
    let page = 1;
    let pages = 1;

    do {
      if (signal?.cancelled) return { blob: null, exported };

      const result = await fetchPage(instanceName, where, page);
      pages = result.pages;
      if (page === 1 && !jid) total = result.total;

      const lines = result.records.map((message) => (format === "jsonl" ? JSON.stringify(message) : toCsvRow(instanceName, message)));
      if (lines.length > 0) parts.push(lines.join("\n") + "\n");

      exported += result.records.length;
      onProgress?.({ exported, total, currentChat: jid ?? undefined });
      page += 1;
    } while (page <= pages);
  }

  const type = format === "jsonl" ? "application/x-ndjson" : "text/csv;charset=utf-8";
  return { blob: new Blob(parts, { type }), exported };
}

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

export const backupFileName = (instanceName: string, format: BackupFormat) => {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return `backup-${instanceName}-${stamp}.${format}`;
};
