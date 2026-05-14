/**
 * FLOWTYM — Edge Function: send-dispute-email
 * Envoie un email de réclamation OTA via Resend API.
 * 
 * POST /functions/v1/send-dispute-email
 * Body: { disputeId, preview?: boolean }
 * 
 * - Si preview = true → retourne le HTML sans envoyer
 * - Si preview = false → envoie via Resend + log dans sas_email_logs
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Email HTML template ──────────────────────────────────────────────────────

function buildDisputeEmailHtml(dispute: any, partner: any, hotel: any): string {
  const deviation = Math.abs(dispute.received_amount - dispute.expected_amount).toFixed(2);
  const deviationPct = dispute.expected_amount > 0
    ? Math.abs(((dispute.received_amount - dispute.expected_amount) / dispute.expected_amount) * 100).toFixed(1)
    : '0';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${dispute.email_subject ?? 'Réclamation FLOWTYM'}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#8B5CF6,#7C3AED);padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 16px;">
                      <span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:-0.5px;">FLOWTYM</span>
                    </div>
                    <p style="color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:12px 0 0;">
                      Revenue Integrity · OTA Dispute Management
                    </p>
                  </td>
                  <td align="right" valign="middle">
                    <span style="background:rgba(255,255,255,0.15);color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;">
                      ${dispute.reference}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
                Madame, Monsieur,
              </p>
              <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
                ${dispute.explanation ?? 'Nous avons détecté une incohérence tarifaire sur la réservation mentionnée en référence. Notre système Revenue Integrity a identifié un écart entre le montant attendu et le montant reçu.'}
              </p>

              <!-- KPI Cards -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td width="33%" style="padding:0 6px 0 0;">
                    <div style="background:#F3F4F6;border-radius:12px;padding:16px;text-align:center;">
                      <p style="color:#9CA3AF;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 6px;">Montant attendu</p>
                      <p style="color:#111827;font-size:22px;font-weight:900;margin:0;">${dispute.expected_amount?.toFixed(2) ?? '—'} €</p>
                    </div>
                  </td>
                  <td width="33%" style="padding:0 3px;">
                    <div style="background:#FEF2F2;border-radius:12px;padding:16px;text-align:center;">
                      <p style="color:#FCA5A5;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 6px;">Montant reçu</p>
                      <p style="color:#DC2626;font-size:22px;font-weight:900;margin:0;">${dispute.received_amount?.toFixed(2) ?? '—'} €</p>
                    </div>
                  </td>
                  <td width="33%" style="padding:0 0 0 6px;">
                    <div style="background:#FFF7ED;border-radius:12px;padding:16px;text-align:center;">
                      <p style="color:#FCD34D;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 6px;">Écart</p>
                      <p style="color:#D97706;font-size:22px;font-weight:900;margin:0;">${deviation} € (${deviationPct}%)</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Claimed amount -->
              <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px;margin:20px 0;">
                <p style="color:#166534;font-size:13px;font-weight:700;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.1em;">
                  Montant réclamé
                </p>
                <p style="color:#14532D;font-size:28px;font-weight:900;margin:0;">
                  ${dispute.claimed_amount?.toFixed(2) ?? deviation} €
                </p>
              </div>

              <!-- Reference info -->
              <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0;color:#6B7280;font-size:13px;">Référence dossier</td>
                    <td style="padding:4px 0;color:#111827;font-size:13px;font-weight:700;text-align:right;">${dispute.reference}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#6B7280;font-size:13px;">Établissement</td>
                    <td style="padding:4px 0;color:#111827;font-size:13px;font-weight:700;text-align:right;">${hotel?.name ?? 'Flowtym Hotel'}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#6B7280;font-size:13px;">Date de création</td>
                    <td style="padding:4px 0;color:#111827;font-size:13px;font-weight:700;text-align:right;">${new Date(dispute.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                </table>
              </div>

              <p style="color:#374151;font-size:15px;line-height:1.7;margin:24px 0;">
                Nous vous demandons de bien vouloir régulariser cette situation dans un délai de <strong>${partner?.dispute_sla_days ?? 7} jours</strong> ouvrables à compter de la réception de ce message.
              </p>

              <p style="color:#374151;font-size:15px;line-height:1.7;margin:0;">
                Dans l'attente de votre retour, nous restons à votre disposition pour tout renseignement complémentaire.
              </p>

              <!-- Signature -->
              <div style="border-top:1px solid #E5E7EB;margin:32px 0 0;padding-top:24px;">
                <p style="color:#111827;font-size:14px;font-weight:700;margin:0 0 4px;">${hotel?.name ?? 'FLOWTYM'}</p>
                <p style="color:#6B7280;font-size:13px;margin:0 0 2px;">Revenue Integrity · Finance</p>
                <p style="color:#8B5CF6;font-size:12px;font-weight:600;margin:0;">Généré automatiquement par FLOWTYM PMS</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:20px 40px;border-top:1px solid #E5E7EB;">
              <p style="color:#9CA3AF;font-size:11px;text-align:center;margin:0;">
                Ce message a été généré automatiquement par FLOWTYM Revenue Integrity Engine.
                Référence dossier : <strong>${dispute.reference}</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const body = await req.json();
    const { disputeId, preview = false, isFollowup = false, followupId } = body;

    if (!disputeId) {
      return new Response(
        JSON.stringify({ error: 'disputeId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Charger le litige ────────────────────────────────────────────────────
    const { data: dispute, error: dispErr } = await supabase
      .from('sas_disputes')
      .select('*, sas_partners(*), hotels(*)')
      .eq('id', disputeId)
      .single();

    if (dispErr || !dispute) {
      return new Response(
        JSON.stringify({ error: 'Dispute not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const partner = dispute.sas_partners;
    const hotel = dispute.hotels;

    // ── Déterminer les destinataires ──────────────────────────────────────────
    const toEmails: string[] = [];
    if (partner?.dispute_email) toEmails.push(partner.dispute_email);
    if (partner?.account_manager_email) toEmails.push(partner.account_manager_email);
    if (partner?.support_email && !toEmails.includes(partner.support_email)) {
      toEmails.push(partner.support_email);
    }
    // Fallback si aucun email partenaire configuré
    if (toEmails.length === 0 && dispute.recipients?.length > 0) {
      toEmails.push(...dispute.recipients);
    }
    if (toEmails.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipient email configured for this partner. Please configure dispute_email in partner settings.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Construire le HTML ────────────────────────────────────────────────────
    const subject = dispute.email_subject
      ?? `[${dispute.reference}] Réclamation tarifaire — ${partner?.name ?? 'Partenaire OTA'}`;
    const html = buildDisputeEmailHtml(dispute, partner, hotel);

    // ── Mode preview ─────────────────────────────────────────────────────────
    if (preview) {
      return new Response(
        JSON.stringify({ html, subject, to: toEmails, from: FROM_EMAIL }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Envoi via Resend ──────────────────────────────────────────────────────
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: toEmails,
        subject,
        html,
        tags: [
          { name: 'dispute_ref', value: dispute.reference },
          { name: 'hotel_id', value: hotel?.id ?? 'unknown' },
          { name: 'partner', value: partner?.code ?? 'unknown' },
        ],
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      // Log l'échec
      await supabase.from('sas_email_logs').insert({
        hotel_id:   hotel?.id,
        dispute_id: disputeId,
        followup_id: followupId ?? null,
        from_email:  FROM_EMAIL,
        to_emails:   toEmails,
        subject,
        status:      'failed',
        error_msg:   JSON.stringify(resendData),
      });

      return new Response(
        JSON.stringify({ error: 'Resend API error', details: resendData }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const resendId = resendData.id;

    // ── Log l'envoi ───────────────────────────────────────────────────────────
    await supabase.from('sas_email_logs').insert({
      hotel_id:    hotel?.id,
      dispute_id:  disputeId,
      followup_id: followupId ?? null,
      resend_id:   resendId,
      from_email:  FROM_EMAIL,
      to_emails:   toEmails,
      subject,
      status:      'sent',
      sent_at:     new Date().toISOString(),
    });

    // ── Log dans dispute_messages ──────────────────────────────────────────────
    await supabase.from('sas_dispute_messages').insert({
      hotel_id:   hotel?.id,
      dispute_id: disputeId,
      direction:  'OUTBOUND',
      content:    `Email envoyé à ${toEmails.join(', ')} — Résend ID: ${resendId}${isFollowup ? ' [RELANCE]' : ''}`,
    });

    // ── Mettre à jour le statut dispute si nécessaire ─────────────────────────
    if (dispute.status === 'DRAFT') {
      await supabase
        .from('sas_disputes')
        .update({ status: 'SENT', sent_at: new Date().toISOString() })
        .eq('id', disputeId);

      // Historique statut
      await supabase.from('sas_dispute_status_history').insert({
        hotel_id:   hotel?.id,
        dispute_id: disputeId,
        old_status: 'DRAFT',
        new_status: 'SENT',
        reason:     `Email envoyé via Resend (${resendId})`,
      });

      // Planifier les relances automatiques
      const followupDays = partner?.followup_days ?? [2, 5, 10];
      const now = new Date();
      const followupInserts = followupDays.map((day: number) => ({
        hotel_id:     hotel?.id,
        dispute_id:   disputeId,
        followup_day: day,
        scheduled_at: new Date(now.getTime() + day * 86_400_000).toISOString(),
        status:       'pending',
      }));
      await supabase.from('sas_dispute_followups').insert(followupInserts);
    }

    // ── Marquer la relance comme envoyée si c'est une relance ─────────────────
    if (isFollowup && followupId) {
      await supabase
        .from('sas_dispute_followups')
        .update({ status: 'sent', sent_at: new Date().toISOString(), email_id: resendId })
        .eq('id', followupId);
    }

    return new Response(
      JSON.stringify({ success: true, resendId, to: toEmails, disputeRef: dispute.reference }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[send-dispute-email]', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
