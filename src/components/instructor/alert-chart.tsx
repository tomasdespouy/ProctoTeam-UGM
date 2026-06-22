
'use client';

import { Pie, PieChart, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { useMemo } from 'react';
import { PieChartIcon } from 'lucide-react';

interface FormattedAlert {
  description: string;
}

interface AlertChartProps {
  alerts: FormattedAlert[];
}

export function getChartData(alerts: FormattedAlert[]) {
  const counts = alerts.reduce((acc: Record<string, number>, alert) => {
    const key = alert.description;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const data = Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
  
  return { chartData: data, totalAlerts: total };
}

export function AlertChart({ alerts }: AlertChartProps) {
  const { chartData, totalAlerts } = useMemo(() => getChartData(alerts), [alerts]);
  
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    if (chartData.length > 0) {
      chartData.forEach((item, index) => {
        const key = item.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        config[key] = {
          label: item.name,
          color: `hsl(var(--chart-${(index % 5) + 1}))`,
        };
      });
    }
    return config;
  }, [chartData]);
  
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    if (percent < 0.05) return null; // Don't show label for slices smaller than 5%
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="hsl(var(--primary-foreground))"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            Distribución de Alertas
          </CardTitle>
          <CardDescription>Principales tipos de alertas generadas durante la sesión.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] w-full items-center justify-center">
            <p className="text-muted-foreground">No hay datos de alertas para mostrar todavía.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
       <CardHeader className="items-center pb-0">
        <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            Distribución de Alertas
        </CardTitle>
        <CardDescription>Tipos de alertas más frecuentes</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-[200px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              labelLine={false}
              label={renderCustomizedLabel}
            >
              {chartData.map((entry, index) => {
                const key = entry.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                return (
                  <Cell key={`cell-${index}`} fill={chartConfig[key]?.color || `hsl(var(--chart-${(index % 5) + 1}))`} />
                )
              })}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-4 text-sm pt-4">
        <div className="w-full flex-grow flex-col gap-2 text-xs">
          {chartData.map((item) => {
            const key = item.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const config = chartConfig[key];
            if (!config) return null;
            return (
              <div key={item.name} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span>{config.label}</span>
                </div>
                <span className="font-semibold text-foreground">{item.percentage}%</span>
              </div>
            );
          })}
        </div>
        <div className="w-full border-t pt-2 mt-2 text-center font-medium text-muted-foreground">
            Total: {totalAlerts} alertas
        </div>
      </CardFooter>
    </Card>
  );
}

    
