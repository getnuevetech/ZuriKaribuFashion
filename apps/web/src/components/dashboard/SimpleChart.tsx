import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  showValues?: boolean;
  maxValue?: number;
}

export function BarChart({ data, height = 200, showValues = true, maxValue }: BarChartProps) {
  const computedMax = maxValue || Math.max(1, ...data.map((d) => d.value)) * 1.1;
  const colors = ['bg-amber-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500'];

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((item, index) => {
          const percentage = (item.value / computedMax) * 100;
          const color = item.color || colors[index % colors.length];
          
          return (
            <div key={item.label} className="flex-1 flex flex-col items-center">
              {showValues && (
                <span className="text-xs font-medium text-gray-600 mb-1">{item.value}</span>
              )}
              <div
                className={`w-full ${color} rounded-t-lg transition-all duration-500`}
                style={{ height: `${percentage}%`, minHeight: percentage > 0 ? 4 : 0 }}
              />
              <span className="text-xs text-gray-500 mt-2 text-center truncate w-full">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  showArea?: boolean;
}

export function LineChart({ data, height = 200, color = '#f59e0b', showArea = true }: LineChartProps) {
  const { path, areaPath, maxValue, labels } = useMemo(() => {
    const safeData = data.length > 0 ? data : [{ label: 'N/A', value: 0 }];
    const max = Math.max(1, ...safeData.map((d) => d.value)) * 1.1;
    const min = 0;
    const range = max - min;
    
    const width = 100;
    const chartHeight = 100;
    
    const points = safeData.map((d, i) => ({
      x: safeData.length === 1 ? width / 2 : (i / (safeData.length - 1)) * width,
      y: chartHeight - ((d.value - min) / range) * chartHeight,
    }));
    
    const pathD = points.reduce((acc, point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`;
      return `${acc} L ${point.x} ${point.y}`;
    }, '');
    
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const areaD = `${pathD} L ${lastPoint.x} ${chartHeight} L ${firstPoint.x} ${chartHeight} Z`;
    
    return {
      path: pathD,
      areaPath: areaD,
      maxValue: max,
      labels: safeData.map((d) => d.label),
    };
  }, [data]);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" className="w-full" style={{ height }} preserveAspectRatio="none">
        {showArea && (
          <path
            d={areaPath}
            fill={color}
            fillOpacity={0.1}
          />
        )}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {(data.length > 0 ? data : [{ label: 'N/A', value: 0 }]).map((d, i, arr) => {
          const x = arr.length === 1 ? 50 : (i / (arr.length - 1)) * 100;
          const y = 100 - (d.value / maxValue) * 100;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={color}
              className="hover:r-4 transition-all"
            />
          );
        })}
      </svg>
      <div className="flex justify-between mt-2">
        {labels.map((label, i) => (
          <span key={i} className="text-xs text-gray-500">{label}</span>
        ))}
      </div>
    </div>
  );
}

interface PieChartProps {
  data: DataPoint[];
  size?: number;
  showLegend?: boolean;
}

export function PieChart({ data, size = 200, showLegend = true }: PieChartProps) {
  const colors = ['#f59e0b', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#06b6d4', '#f97316', '#8b5cf6'];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  let currentAngle = 0;
  const slices = data.map((item, index) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = ((startAngle + angle) * Math.PI) / 180;
    
    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
    
    return {
      path,
      color: item.color || colors[index % colors.length],
      label: item.label,
      value: item.value,
      percentage: Math.round(percentage * 100),
    };
  });

  return (
    <div className="flex items-center gap-8">
      <svg width={size} height={size} viewBox="0 0 100 100" className="flex-shrink-0">
        {slices.map((slice, index) => (
          <path
            key={index}
            d={slice.path}
            fill={slice.color}
            stroke="white"
            strokeWidth="2"
            className="hover:opacity-80 transition-opacity cursor-pointer"
          />
        ))}
        <circle cx="50" cy="50" r="20" fill="white" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="text-xs font-bold fill-gray-700">
          {total}
        </text>
      </svg>
      
      {showLegend && (
        <div className="space-y-2">
          {slices.map((slice, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="text-sm text-gray-600">{slice.label}</span>
              <span className="text-sm font-medium text-gray-900">{slice.percentage}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
