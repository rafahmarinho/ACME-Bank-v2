"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCents, formatPlainDate } from "@/lib/format";

const balanceConfig = { balance: { label: "Balance", color: "var(--chart-1)" } } satisfies ChartConfig;

export function BalanceChart({ data }: { data: { date: string; balance: number }[] }) {
  return (
    <ChartContainer config={balanceConfig} className="aspect-auto h-56 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={36}
          tickFormatter={(d: string) => formatPlainDate(d).replace(/, \d{4}$/, "")}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => `$${Math.round(v / 100000)}k`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => formatPlainDate(p?.[0]?.payload?.date)}
              formatter={(v) => <span className="font-semibold tabular">{formatCents(Number(v))}</span>}
            />
          }
        />
        <Area dataKey="balance" type="monotone" stroke="var(--color-balance)" strokeWidth={2} fill="url(#balFill)" />
      </AreaChart>
    </ChartContainer>
  );
}

const spendConfig = { total: { label: "Spent", color: "var(--chart-2)" } } satisfies ChartConfig;

export function SpendingChart({ data }: { data: { category: string; total: number }[] }) {
  return (
    <ChartContainer config={spendConfig} className="aspect-auto h-56 w-full">
      <BarChart data={data.slice(0, 7)} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} width={104} />
        <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v, _n, p) => (
          <span className="flex w-full justify-between gap-4"><span>{p.payload.category}</span><span className="font-semibold tabular">{formatCents(Number(v))}</span></span>
        )} />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={6} barSize={18} />
      </BarChart>
    </ChartContainer>
  );
}
