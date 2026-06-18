/**
 * FLOWTYM RMS — Agrégats Distribution & OTA (pures fonctions testables).
 *
 * Extrait depuis DistributionAnalytics.tsx pour permettre des tests de
 * régression sur les cas dégénérés (channelData vide, totalRevenue = 0, etc.)
 * qui faisaient crasher la page en conditions réelles via NaN cascades.
 *
 * Garde-fou : aucun calcul ne doit jamais produire NaN ou Infinity, même
 * avec des entrées vides ou nulles. Recharts crash si on lui passe NaN.
 */

export interface DistributionChannelLike {
  id: string;
  name: string;
  revenue: number;
  netRevenue: number;
  commissionCost: number;
  bookings: number;
  roomNights: number;
  revpar: number;
  conversion: number;
  cancellationRate: number;
}

export interface DistributionRealTotalsLike {
  totalRevenue: number;
  totalBookings: number;
  totalRoomNights: number;
  avgADR: number;
  avgRevPAR: number;
}

export interface DistributionTotals {
  totalRevenue: number;
  totalNet: number;
  totalCommission: number;
  totalBookings: number;
  totalNights: number;
  avgADR: number;
  avgRevPAR: number;
  avgConv: string;
  avgCancel: string;
  commissionPct: number;
  directShare: number;
  otaShare: number;
}

export interface DistributionDependency {
  topOTAName: string;
  topOTAShare: number;
  directShare: number;
}

/**
 * Calcule les KPIs globaux Distribution.
 *
 * Bascule sur `realTotals` (rateCalendar) quand disponibles. Sinon, agrège
 * les valeurs démonstratives du mock. Tous les diviseurs sont guardés par
 * Math.max(1, ...) pour ne jamais produire NaN.
 */
export function computeDistributionTotals(
  channelData: DistributionChannelLike[],
  realTotals: DistributionRealTotalsLike | null
): DistributionTotals {
  const safeChannelCount = Math.max(1, channelData.length);

  const mockRevenue = channelData.reduce((s, c) => s + c.revenue, 0);
  const mockNet = channelData.reduce((s, c) => s + c.netRevenue, 0);
  const mockCommission = channelData.reduce((s, c) => s + c.commissionCost, 0);
  const mockBookings = channelData.reduce((s, c) => s + c.bookings, 0);
  const mockNights = channelData.reduce((s, c) => s + c.roomNights, 0);
  const mockADR = Math.round(mockRevenue / Math.max(1, mockNights));
  const mockRevPAR = Math.round(
    channelData.reduce((s, c) => s + c.revpar, 0) / safeChannelCount
  );

  const totalRevenue = realTotals?.totalRevenue ?? mockRevenue;
  const totalBookings = realTotals?.totalBookings ?? mockBookings;
  const totalNights = realTotals?.totalRoomNights ?? mockNights;
  const avgADR = realTotals?.avgADR ?? mockADR;
  const avgRevPAR = realTotals?.avgRevPAR ?? mockRevPAR;

  const mockCommissionPct = (mockCommission / Math.max(1, mockRevenue)) * 100;
  const totalCommission = realTotals
    ? Math.round((totalRevenue * mockCommissionPct) / 100)
    : mockCommission;
  const totalNet = totalRevenue - totalCommission;

  const avgConv = (
    channelData.reduce((s, c) => s + c.conversion, 0) / safeChannelCount
  ).toFixed(1);
  const avgCancel = (
    channelData.reduce((s, c) => s + c.cancellationRate, 0) / safeChannelCount
  ).toFixed(1);
  const commissionPct = (totalCommission / Math.max(1, totalRevenue)) * 100;
  const direct = channelData.find((c) => c.id === 'direct');
  const directShare = ((direct?.revenue ?? 0) / Math.max(1, mockRevenue)) * 100;
  const otaShare = 100 - directShare;

  return {
    totalRevenue,
    totalNet,
    totalCommission,
    totalBookings,
    totalNights,
    avgADR,
    avgRevPAR,
    avgConv,
    avgCancel,
    commissionPct,
    directShare,
    otaShare,
  };
}

/**
 * Calcule la dépendance OTA (top OTA + part directe).
 *
 * Garde-fou : Math.max(1, totalRevenue) pour éviter NaN si aucun revenu.
 */
export function computeDistributionDependency(
  channelData: DistributionChannelLike[],
  totalRevenue: number
): DistributionDependency {
  const sortedRev = [...channelData].sort((a, b) => b.revenue - a.revenue);
  const topOTA = sortedRev.find((c) => c.id !== 'direct');
  const direct = channelData.find((c) => c.id === 'direct');
  const safeTotalRevenue = Math.max(1, totalRevenue);
  return {
    topOTAName: topOTA?.name ?? '',
    topOTAShare: ((topOTA?.revenue ?? 0) / safeTotalRevenue) * 100,
    directShare: ((direct?.revenue ?? 0) / safeTotalRevenue) * 100,
  };
}
