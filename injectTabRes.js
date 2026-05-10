const fs = require('fs');

let code = fs.readFileSync('src/components/modals/ReservationDetailsModal.tsx', 'utf8');

const tabResStart = code.indexOf('// ─── ONGLET 1 : RÉSERVATION');
const tabFactStart = code.indexOf('// ─── ONGLET 2 : FACTURATION');

const newTabRes = `// ─── ONGLET 1 : RÉSERVATION ───────────────────────────────────────────────────
const TabReservation: React.FC<{ res: Reservation; onUpdate?: (updated: Reservation) => void }> = ({ res, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editedRes, setEditedRes] = useState<any>({ ...res });
  
  const statusColors: Record<string, { label: string; color: string; bg: string }> = {
    confirmed:    { label: 'Confirmée',    color: '#2563EB', bg: '#EFF6FF' },
    pending:      { label: 'Brouillon',    color: '#D97706', bg: '#FFF7ED' },
    checked_in:   { label: 'En séjour',    color: '#059669', bg: '#ECFDF5' },
    checked_out:  { label: 'Départ',       color: '#64748B', bg: '#F8FAFC' },
    cancelled:    { label: 'Annulée',      color: '#DC2626', bg: '#FEF2F2' },
    no_show:      { label: 'No-Show',      color: '#9F1239', bg: '#FFF1F2' },
  };
  const st = statusColors[res.status] || statusColors.confirmed;

  const handleAction = async (action: string, newStatus?: string) => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      let updated = { ...res };
      if (newStatus) {
        updated.status = newStatus;
      }
      if (action === 'save') {
        updated = { ...editedRes };
        setIsEditing(false);
      }
      if (onUpdate) onUpdate(updated);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: \`Action '\${action}' effectuée avec succès.\` } }));
    }, 1000);
  };

  const handleConfirm = () => {
    if (window.confirm('Voulez-vous vraiment confirmer cette réservation ?')) {
      handleAction('Confirmation', 'confirmed');
    }
  };

  const handleCancel = () => {
    if (window.confirm('Voulez-vous vraiment annuler cette réservation ?')) {
      handleAction('Annulation', 'cancelled');
    }
  };

  const rows = [
    { label: 'N° réservation', field: 'id', editable: false },
    { label: 'Client',         field: 'guestName', editable: true },
    { label: 'Email',          field: 'email', editable: true },
    { label: 'Téléphone',      field: 'phone', editable: true },
    { label: 'Nationalité',    field: 'nationality', editable: true },
    { label: 'Chambre',        field: 'room', editable: true },
    { label: 'Arrivée',        field: 'checkin', editable: true, type: 'date' },
    { label: 'Départ',         field: 'checkout', editable: true, type: 'date' },
    { label: 'Durée',          value: \`\${res.nights} nuit(s)\`, editable: false },
    { label: 'Canal',          field: 'canal', editable: true },
    { label: 'Montant TTC',    value: fmtEuro(res.montant), editable: false },
    { label: 'Solde restant',  value: fmtEuro(res.solde), highlight: res.solde > 0, editable: false },
    { label: 'Mode de paiement', field: 'paymentMode', editable: true },
    { label: 'Statut paiement', field: 'paymentStatus', editable: true },
    { label: 'Garantie',       field: 'guaranteeType', editable: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 100, background: st.bg, color: st.color }}>
          ● {st.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>Créée le {fmtDate(TODAY)}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Impression de la fiche...' }})); setTimeout(() => window.print(), 500); }} style={{ width: 28, height: 28, borderRadius: 6, background: '#F1F5F9', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Imprimer la fiche">
              <Printer size={14} />
            </button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Menu envoi (Email/Proforma/Lien de paiement)' }}))} style={{ width: 28, height: 28, borderRadius: 6, background: '#EFF6FF', border: 'none', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Envoyer par email">
              <Mail size={14} />
            </button>
            <button disabled={!isEditing} onClick={() => handleAction('save')} style={{ width: 28, height: 28, borderRadius: 6, background: isEditing ? '#ECFDF5' : '#F8FAFC', border: 'none', color: isEditing ? '#10B981' : '#CBD5E1', cursor: isEditing ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Enregistrer">
              <Save size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Grille 2 colonnes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ ...CARD, padding: '12px 16px' }}>
            <span style={LABEL}>{r.label}</span>
            {isEditing && r.editable ? (
              <input 
                type={r.type || 'text'}
                value={editedRes[r.field] || ''} 
                onChange={(e) => setEditedRes({...editedRes, [r.field]: e.target.value})}
                style={{ ...FIELD, marginTop: 4, padding: '4px 8px', fontSize: 12, height: 'auto' }}
              />
            ) : (
              <span style={{ ...VALUE, color: r.highlight ? '#DC2626' : '#1E293B', fontWeight: r.highlight ? 800 : 600 }}>
                {r.value || res[r.field as keyof Reservation] || '—'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Notes et Journal d'Audit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={CARD}>
          <span style={LABEL}>Notes internes</span>
          <textarea
            defaultValue={res.notes || ''}
            placeholder="Ajouter une note interne..."
            disabled={!isEditing}
            onChange={(e) => setEditedRes({...editedRes, notes: e.target.value})}
            style={{ ...FIELD, resize: 'vertical', minHeight: 80, width: '100%', opacity: isEditing ? 1 : 0.7 }}
          />
        </div>
        <div style={CARD}>
          <span style={LABEL}>Journal d'Audit</span>
          <div style={{ fontSize: 11, color: '#64748B', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <div><strong style={{color: '#1E293B'}}>Aujourd'hui 09:42</strong> - Modification de la fiche par Admin</div>
            <div><strong style={{color: '#1E293B'}}>Hier 14:10</strong> - Statut passé à Confirmée par Admin</div>
            <div><strong style={{color: '#1E293B'}}>Hier 14:05</strong> - Création de la réservation (Site Web)</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {!isEditing ? (
          <>
            <button disabled={res.status === 'confirmed' || isLoading} onClick={handleConfirm} style={{ ...BTN('primary'), opacity: res.status === 'confirmed' ? 0.5 : 1 }}>
              {isLoading ? '...' : <Check size={14}/>} Confirmer le séjour
            </button>
            <button onClick={() => setIsEditing(true)} style={BTN('ghost')}>
              <Edit size={14}/> Modifier
            </button>
            <button disabled={res.status === 'cancelled' || isLoading} onClick={handleCancel} style={{ ...BTN('danger'), opacity: res.status === 'cancelled' ? 0.5 : 1 }}>
              <X size={14}/> Annuler la réservation
            </button>
          </>
        ) : (
          <>
            <button onClick={() => handleAction('save')} style={{ ...BTN('primary'), background: '#10B981' }} disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
            <button onClick={() => { setIsEditing(false); setEditedRes({...res}); }} style={BTN('ghost')}>
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  );
};
`;

code = code.substring(0, tabResStart) + newTabRes + code.substring(tabFactStart);

code = code.replace(
  '{activeTab === \\'reservation\\' && <TabReservation res={reservation} />}',
  '{activeTab === \\'reservation\\' && <TabReservation res={reservation} onUpdate={onUpdate} />}'
);

fs.writeFileSync('src/components/modals/ReservationDetailsModal.tsx', code, 'utf8');
console.log('TabReservation injected successfully!');
