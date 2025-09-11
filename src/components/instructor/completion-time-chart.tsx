
'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { useMemo } from 'react';
import type { StudentSession } from '@/services/live-session.service';
import { Clock, Timer, Zap, Turtle } from 'lucide-react';

interface CompletionTimeChartProps {
  students: StudentSession[];
}

const chartConfig = {
  duration: {
    label: 'Duración (min)',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export function getChartData(students: StudentSession[]) {
    const finishedStudentsData = students
      .filter(s => s.status === 'finished' && s.startTime && s.finishTime)
      .map(s => ({
        name: s.name.split(' ')[0], // Use first name
        duration: parseFloat(((s.finishTime! - s.startTime!) / 60000).toFixed(1)),
      }))
      .sort((a, b) => a.duration - b.duration);

    if (finishedStudentsData.length === 0) {
        return { chartData: [], stats: { average: 0, fastest: 0, slowest: 0 } };
    }

    const durations = finishedStudentsData.map(s => s.duration);
    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const fastest = Math.min(...durations);
    const slowest = Math.max(...durations);

    return {
        chartData: finishedStudentsData,
        stats: {
            average: parseFloat(average.toFixed(1)),
            fastest: parseFloat(fastest.toFixed(1)),
            slowest: parseFloat(slowest.toFixed(1))
        }
    };
}


export function CompletionTimeChart({ students }: CompletionTimeChartProps) {
  const { chartData, stats } = useMemo(() => getChartData(students), [students]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Tiempos de Finalización
          </CardTitle>
          <CardDescription>Duración que tardó cada estudiante en finalizar el examen.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[320px] w-full items-center justify-center">
            <p className="text-muted-foreground">Aún no hay estudiantes que hayan finalizado.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
         <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Tiempos de Finalización
          </CardTitle>
        <CardDescription>Duración que tardó cada estudiante en finalizar el examen (en minutos).</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart accessibilityLayer data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
             <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              angle={-45}
              textAnchor="end"
              interval={0}
              height={50}
              className="text-xs"
            />
            <YAxis 
                dataKey="duration" 
                type="number"
                label={{ value: "Minutos", angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' }, className:"fill-muted-foreground text-xs" }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent labelClassName="font-bold" />}
            />
            <Bar dataKey="duration" fill="var(--color-duration)" radius={4}>
                <LabelList dataKey="duration" position="top" offset={4} className="fill-foreground" fontSize={12} />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 border-t pt-4">
        <h4 className="font-semibold text-muted-foreground px-2">Resumen de Tiempos</h4>
        <div className="grid grid-cols-3 gap-2 w-full text-center">
            <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-md bg-secondary">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    <span>Más Rápido</span>
                </div>
                <span className="text-lg font-bold">{stats.fastest} min</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-md bg-secondary">
                 <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Timer className="h-3 w-3" />
                    <span>Promedio</span>
                </div>
                <span className="text-lg font-bold">{stats.average} min</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-md bg-secondary">
                 <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Turtle className="h-3 w-3" />
                    <span>Más Lento</span>
                </div>
                <span className="text-lg font-bold">{stats.slowest} min</span>
            </div>
        </div>
      </CardFooter>
    </Card>
  );
}

    