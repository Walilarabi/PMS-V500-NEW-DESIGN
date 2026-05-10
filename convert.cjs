const fs = require('fs');
let code = fs.readFileSync('c:/Users/walil/Downloads/FicheReservation.tsx', 'utf8');

code = code.replace('export const FicheReservation:', 'export const ReservationDetailsModal:');
code = code.replace('export default FicheReservation;', 'export default ReservationDetailsModal;');

code = code.replace(
  'interface FicheReservationProps {', 
  'interface FicheReservationProps {\\n  isOpen?: boolean;'
);

code = code.replace(
  'reservation, allReservations = [], onClose, onUpdate\\n}) => {',
  'reservation: rawReservation, allReservations: rawAllRes = [], isOpen = true, onClose, onUpdate\\n}) => {\\n  if (!isOpen || !rawReservation) return null;\\n\\n  const adaptRes = (r) => ({ ...r, guestName: r.client, checkin: r.arrival ? r.arrival.split(" ")[0] : r.arrival, checkout: r.departure ? r.departure.split(" ")[0] : r.departure, montant: r.totalAmount || 0, solde: 0, nights: Math.max(1, Math.ceil((new Date(r.departure).getTime() - new Date(r.arrival).getTime()) / 86400000)) });\\n  const reservation = adaptRes(rawReservation);\\n  const allReservations = rawAllRes.map(adaptRes);\\n'
);

code = code.replace("import { Reservation } from '../store/reservationStore';", "import { Reservation } from '../../contexts/ReservationContext';");

fs.writeFileSync('c:/Users/walil/Downloads/PMS-V500-NEW-DESIGN-main/PMS-V500-NEW-DESIGN-main/src/components/modals/ReservationDetailsModal.tsx', code, 'utf8');
console.log('Done!');
