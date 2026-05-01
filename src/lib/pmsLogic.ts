import { ReservationFormData } from '../components/modals/ReservationFormModal';

export interface ReportKPIs {
  occupancyRate: number;
  adr: number;
  revPar: number;
  totalRevenue: number;
  totalNights: number;
  avgStayLength: number;
}

export const calculateKPIs = (reservations: any[], totalRoomsCount: number, period?: { start: string, end: string }): ReportKPIs => {
  let filtered = reservations.filter(r => r.status !== 'cancelled');
  if (period) {
    filtered = filtered.filter(r => r.checkIn >= period.start && r.checkIn <= period.end);
  }
  
  const totalNights = filtered.reduce((sum, r) => sum + (r.nights || 0), 0);
  const totalRevenue = filtered.reduce((sum, r) => sum + (r.totalTTC || 0), 0);
  
  const occupancyRate = totalRoomsCount > 0 ? (totalNights / (totalRoomsCount * 30)) * 100 : 0; 
  const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
  const revPar = totalRoomsCount > 0 ? totalRevenue / (totalRoomsCount * 30) : 0;
  
  return {
    occupancyRate: Math.min(100, Math.max(0, occupancyRate)),
    adr,
    revPar,
    totalRevenue,
    totalNights,
    avgStayLength: filtered.length > 0 ? totalNights / filtered.length : 0
  };
};

export const getComparisonData = (reservations: any[], totalRoomsCount: number, currentPeriod: { start: string, end: string }) => {
  const currentKpis = calculateKPIs(reservations, totalRoomsCount, currentPeriod);
  
  const lastYearStart = new Date(currentPeriod.start);
  lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
  const lastYearEnd = new Date(currentPeriod.end);
  lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);
  
  // Use YYYY-MM-DD exactly
  const lastYearStartStr = lastYearStart.toISOString().split('T')[0];
  const lastYearEndStr = lastYearEnd.toISOString().split('T')[0];

  const lastYearKpis = calculateKPIs(reservations, totalRoomsCount, { 
    start: lastYearStartStr, 
    end: lastYearEndStr 
  });

  const getDiff = (curr: number, prev: number) => {
    if (prev === 0) return 0;
    return ((curr - prev) / prev) * 100;
  };

  return {
    current: currentKpis,
    previous: lastYearKpis,
    diff: {
      totalRevenue: getDiff(currentKpis.totalRevenue, lastYearKpis.totalRevenue),
      occupancyRate: getDiff(currentKpis.occupancyRate, lastYearKpis.occupancyRate),
      adr: getDiff(currentKpis.adr, lastYearKpis.adr),
      revPar: getDiff(currentKpis.revPar, lastYearKpis.revPar)
    }
  };
};

export const getOccupancyByDay = (reservations: any[], days: number = 30) => {
  const data: Record<string, number> = {};
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    data[dateStr] = 0;
    
    reservations.forEach(r => {
      if (r.checkIn <= dateStr && r.checkOut > dateStr && r.status !== 'cancelled') {
        data[dateStr]++;
      }
    });
  }
  
  return Object.entries(data).map(([date, count]) => ({ date, count }));
};

export const getRevenueByChannel = (reservations: any[]) => {
  const channels: Record<string, number> = {};
  reservations.forEach(r => {
    if (r.status !== 'cancelled') {
      const channel = r.channel || 'Direct';
      channels[channel] = (channels[channel] || 0) + (r.totalTTC || 0);
    }
  });
  return Object.entries(channels).map(([name, value]) => ({ name, value }));
};

export const getRevenueBySegment = (reservations: any[]) => {
  const segments: Record<string, number> = {};
  reservations.forEach(r => {
    if (r.status !== 'cancelled') {
      const segment = r.segment || 'Loisir';
      segments[segment] = (segments[segment] || 0) + (r.totalTTC || 0);
    }
  });
  return Object.entries(segments).map(([name, value]) => ({ name, value }));
};
