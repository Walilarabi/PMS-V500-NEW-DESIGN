/**
 * FLOWTYM — Realtime subscriptions root.
 *
 * Mounts realtime listeners once at app startup so domain pages do not have
 * to re-subscribe on every navigation. Returns null — purely side-effectful.
 */
import { useReservationsRealtime } from '@/src/domains/reservations/realtime';

export const RealtimeBridge = () => {
  useReservationsRealtime();
  return null;
};

export default RealtimeBridge;
