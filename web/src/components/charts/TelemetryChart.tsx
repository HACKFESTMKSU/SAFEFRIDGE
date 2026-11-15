import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { TelemetryReading } from '../../types'

export function TelemetryChart({ data }: { data: TelemetryReading[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: format(parseISO(d.timestamp), 'HH:mm'),
  }))

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2ecef" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#5a727c', fontSize: 11 }}
            minTickGap={28}
          />
          <YAxis
            yAxisId="temp"
            tick={{ fill: '#5a727c', fontSize: 11 }}
            width={40}
          />
          <YAxis
            yAxisId="hum"
            orientation="right"
            tick={{ fill: '#5a727c', fontSize: 11 }}
            width={36}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #d5e2e7',
              fontFamily: 'Outfit, sans-serif',
            }}
          />
          <Legend />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperature_c"
            name="Temp °C"
            stroke="#0f8a7a"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="hum"
            type="monotone"
            dataKey="humidity_percent"
            name="Humidity %"
            stroke="#0b3d4a"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
