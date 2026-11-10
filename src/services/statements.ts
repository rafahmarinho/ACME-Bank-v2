import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DbClient } from "@/lib/supabase/server";
import { formatCents, formatDate, formatDateTime, formatPlainDate } from "@/lib/format";
import { getAccount, getLedger } from "./accounts";

export async function buildStatement(db: DbClient, accountId: string, from: string, to: string) {
  const account = await getAccount(db, accountId);
  if (!account) return null;
  const [{ data: owner }, ledger] = await Promise.all([
    db.from("profiles").select("full_name, address_line1, city, state, postal_code, customer_number").eq("id", account.owner_id!).maybeSingle(),
    getLedger(db, accountId, from, to),
  ]);
  return { account, owner, from, to, ...ledger };
}

export type Statement = NonNullable<Awaited<ReturnType<typeof buildStatement>>>;

const csvCell = (v: string | number) => {
  const s = String(v);
  // Neutralize spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function statementToCsv(s: Statement) {
  const lines = [
    ["ACME Bank account statement"],
    ["Account", `${s.account.nickname} ${s.account.account_number}`],
    ["Period", `${s.from} to ${s.to}`],
    ["Opening balance", (s.opening / 100).toFixed(2)],
    ["Total credits", (s.credits / 100).toFixed(2)],
    ["Total debits", (s.debits / 100).toFixed(2)],
    ["Closing balance", (s.closing / 100).toFixed(2)],
    [],
    ["Date", "Reference", "Description", "Category", "Debit", "Credit", "Balance"],
    ...s.entries.map((e) => [
      formatDateTime(e.created_at),
      e.transactions?.reference ?? "",
      e.memo ?? "",
      e.transactions?.category ?? "",
      e.direction === "debit" ? (e.amount_cents / 100).toFixed(2) : "",
      e.direction === "credit" ? (e.amount_cents / 100).toFixed(2) : "",
      (e.balance_after_cents / 100).toFixed(2),
    ]),
  ];
  return "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
}

// Standard PDF fonts only support WinAnsi characters.
const pdfSafe = (s: string) => s.replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "?");

export async function statementToPdf(s: Statement) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`ACME Bank statement ${s.account.account_number} ${s.from} – ${s.to}`);
  pdf.setAuthor("ACME Bank");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.08, 0.15, 0.3);
  const orange = rgb(0.96, 0.48, 0.13);
  const gray = rgb(0.42, 0.45, 0.52);
  const W = 612;
  const H = 792;
  const M = 40;

  const text = (page: PDFPage, t: string, x: number, y: number, size = 9, f: PDFFont = font, color = navy) =>
    page.drawText(pdfSafe(t), { x, y, size, font: f, color });
  const right = (page: PDFPage, t: string, xr: number, y: number, size = 9, f: PDFFont = font, color = navy) =>
    text(page, t, xr - f.widthOfTextAtSize(pdfSafe(t), size), y, size, f, color);
  const clip = (t: string, width: number, size = 8.5) => {
    let out = pdfSafe(t);
    while (out.length > 3 && font.widthOfTextAtSize(out, size) > width) out = out.slice(0, -2);
    return out === pdfSafe(t) ? out : out.trimEnd() + "...";
  };

  const cols = { date: M, desc: M + 78, debit: 430, credit: 500, balance: W - M };

  let page = pdf.addPage([W, H]);
  let y = 0;
  let pageNo = 1;

  const header = (first: boolean) => {
    page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: navy });
    page.drawRectangle({ x: 0, y: H - 74, width: W, height: 4, color: orange });
    text(page, "ACME", M, H - 44, 22, bold, rgb(1, 1, 1));
    text(page, "BANK", M + bold.widthOfTextAtSize("ACME ", 22), H - 44, 22, bold, orange);
    right(page, "Account statement", W - M, H - 38, 12, bold, rgb(1, 1, 1));
    right(page, `${formatPlainDate(s.from)} – ${formatPlainDate(s.to)}`, W - M, H - 54, 9, font, rgb(0.85, 0.88, 0.95));
    y = H - 100;
    if (first) {
      text(page, s.owner?.full_name ?? "", M, y, 11, bold);
      if (s.owner?.address_line1) text(page, s.owner.address_line1, M, y - 14, 9, font, gray);
      if (s.owner?.city) text(page, `${s.owner.city}, ${s.owner.state ?? ""} ${s.owner.postal_code ?? ""}`, M, y - 26, 9, font, gray);
      right(page, `${s.account.nickname}`, W - M, y, 11, bold);
      right(page, `Account ${s.account.account_number} · Routing ${s.account.routing_number}`, W - M, y - 14, 9, font, gray);
      right(page, `Customer ${s.owner?.customer_number ?? "—"}`, W - M, y - 26, 9, font, gray);
      y -= 52;
      const boxes = [
        ["Opening balance", formatCents(s.opening)],
        ["Total credits", formatCents(s.credits)],
        ["Total debits", formatCents(s.debits)],
        ["Closing balance", formatCents(s.closing)],
      ];
      const bw = (W - 2 * M - 30) / 4;
      boxes.forEach(([label, value], i) => {
        const x = M + i * (bw + 10);
        page.drawRectangle({ x, y: y - 40, width: bw, height: 46, color: rgb(0.95, 0.96, 0.98), borderColor: rgb(0.88, 0.9, 0.94), borderWidth: 0.6 });
        text(page, label, x + 10, y - 10, 8, font, gray);
        text(page, value, x + 10, y - 28, 12, bold, i === 3 ? orange : navy);
      });
      y -= 64;
    }
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: rgb(0.93, 0.94, 0.97) });
    text(page, "Date", cols.date + 4, y, 8.5, bold);
    text(page, "Description", cols.desc, y, 8.5, bold);
    right(page, "Debit", cols.debit, y, 8.5, bold);
    right(page, "Credit", cols.credit, y, 8.5, bold);
    right(page, "Balance", cols.balance - 4, y, 8.5, bold);
    y -= 22;
  };

  const footer = () => {
    page.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
    text(page, "ACME Bank is a simulated bank for demonstration purposes. Deposits are not real.", M, 28, 7.5, font, gray);
    right(page, `Page ${pageNo}`, W - M, 28, 7.5, font, gray);
  };

  header(true);
  if (s.entries.length === 0) {
    text(page, "No posted transactions in this period.", M + 4, y, 9, font, gray);
  }
  s.entries.forEach((e, i) => {
    if (y < 64) {
      footer();
      page = pdf.addPage([W, H]);
      pageNo++;
      header(false);
    }
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 17, color: rgb(0.98, 0.98, 0.99) });
    text(page, formatDate(e.created_at), cols.date + 4, y, 8.5);
    text(page, clip(`${e.memo ?? ""}${e.transactions?.reference ? `  ·  ${e.transactions.reference}` : ""}`, cols.debit - cols.desc - 60), cols.desc, y, 8.5);
    if (e.direction === "debit") right(page, formatCents(e.amount_cents), cols.debit, y, 8.5);
    if (e.direction === "credit") right(page, formatCents(e.amount_cents), cols.credit, y, 8.5, font, rgb(0.05, 0.5, 0.3));
    right(page, formatCents(e.balance_after_cents), cols.balance - 4, y, 8.5, bold);
    y -= 17;
  });
  footer();
  return pdf.save();
}
