import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const appOrigin = Deno.env.get('APP_URL') ?? 'http://localhost:5173';
const allow = new Set([appOrigin, 'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174']);
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allow.has(origin) ? origin : appOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});
const response = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });
const cleanPhone = (value: string | null) => (value ?? '').replace(/[\s()-]/g, '');
type Channel = 'sms' | 'whatsapp';
type Audience = 'all' | 'fresher' | 'experienced';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405, origin);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'Sign in required' }, 401, origin);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return response({ error: 'Invalid session' }, 401, origin);
  if (user.app_metadata?.role !== 'admin') return response({ error: 'Administrator access required' }, 403, origin);

  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return response({ error: 'Invalid request body' }, 400, origin); }
  const admin = createClient(url, service);
  const twilioConfigured = Boolean(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN'));
  const smsTrialMode = (Deno.env.get('TWILIO_SMS_TRIAL_MODE') ?? '').toLowerCase() === 'true';
  const action = input.action;

  if (action === 'config') {
    return response({
      sms: twilioConfigured && Boolean(Deno.env.get('TWILIO_SMS_FROM')) && !smsTrialMode,
      smsTest: twilioConfigured && Boolean(Deno.env.get('TWILIO_SMS_FROM')) && smsTrialMode,
      smsTrialMode,
      whatsapp: twilioConfigured && Boolean(Deno.env.get('TWILIO_WHATSAPP_FROM') && Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID')),
      razorpay: Boolean(Deno.env.get('RAZORPAY_KEY_ID') && Deno.env.get('RAZORPAY_KEY_SECRET') && Deno.env.get('RAZORPAY_WEBHOOK_SECRET')),
      mode: (Deno.env.get('RAZORPAY_KEY_ID') ?? '').startsWith('rzp_live_') ? 'live' : 'test',
    }, 200, origin);
  }

  if (action === 'list') {
    const { data, error } = await admin.from('notification_campaigns').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) return response({ error: 'Could not load campaigns' }, 500, origin);
    return response({ campaigns: data ?? [] }, 200, origin);
  }

  const getEligible = async (channel: Channel, audience: Audience) => {
    let query = admin.from('profiles').select('id,phone,phone_verified,experience,whatsapp_opt_in,sms_opt_in,role').eq('role', 'candidate');
    query = channel === 'whatsapp' ? query.eq('whatsapp_opt_in', true) : query.eq('sms_opt_in', true);
    const { data, error } = await query.not('phone', 'is', null).limit(1000);
    if (error) throw new Error('Could not select eligible recipients');
    const rows = (data ?? []).filter((row) => {
      if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone(row.phone))) return false;
      if (channel === 'whatsapp' && !row.phone_verified) return false;
      const fresher = (row.experience ?? '').toLowerCase().includes('fresh');
      return audience === 'all' || (audience === 'fresher' ? fresher : !fresher);
    });
    return rows;
  };

  if (action === 'preview') {
    const channel = input.channel as Channel;
    const audience = input.audience as Audience;
    if (!['sms', 'whatsapp'].includes(channel) || !['all', 'fresher', 'experienced'].includes(audience)) {
      return response({ error: 'Choose a valid channel and audience' }, 400, origin);
    }
    if (channel === 'sms' && smsTrialMode) return response({ error: 'Bulk SMS campaigns are unavailable in Twilio trial mode. Use the profile SMS delivery check to send a preset message to your own verified number.' }, 403, origin);
    try {
      const recipients = await getEligible(channel, audience);
      return response({ eligible: recipients.length, capped: recipients.length === 1000 }, 200, origin);
    } catch (error) {
      return response({ error: error instanceof Error ? error.message : 'Preview failed' }, 500, origin);
    }
  }

  if (action === 'create') {
    const title = String(input.title ?? '').trim();
    const message = String(input.message ?? '').trim();
    const channel = input.channel as Channel;
    const audience = input.audience as Audience;
    const jobId = typeof input.jobId === 'string' && input.jobId ? input.jobId : null;
    if (title.length < 3 || title.length > 120 || message.length < 1 || message.length > 1200) {
      return response({ error: 'Enter a campaign name and message within the allowed lengths' }, 400, origin);
    }
    if (!['sms', 'whatsapp'].includes(channel) || !['all', 'fresher', 'experienced'].includes(audience)) {
      return response({ error: 'Choose a valid channel and audience' }, 400, origin);
    }
    if (channel === 'sms' && smsTrialMode) return response({ error: 'Bulk SMS campaigns are unavailable in Twilio trial mode. Use the profile SMS delivery check to send a preset message to your own verified number.' }, 403, origin);
    if ((channel === 'sms' && (!twilioConfigured || !Deno.env.get('TWILIO_SMS_FROM'))) ||
      (channel === 'whatsapp' && (!twilioConfigured || !Deno.env.get('TWILIO_WHATSAPP_FROM') || !Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID')))) {
      return response({ error: 'The selected Twilio channel is not fully configured' }, 503, origin);
    }
    try {
      const recipients = await getEligible(channel, audience);
      const { data: campaign, error } = await admin.from('notification_campaigns').insert({
        created_by: user.id, title, message, channel, audience, job_id: jobId, total_recipients: recipients.length, status: 'draft',
      }).select('*').single();
      if (error || !campaign) return response({ error: 'Could not save this campaign' }, 500, origin);
      if (recipients.length) {
        const values = recipients.map((recipient) => ({ campaign_id: campaign.id, user_id: recipient.id, channel }));
        const { error: recipientsError } = await admin.from('campaign_recipients').insert(values);
        if (recipientsError) {
          await admin.from('notification_campaigns').delete().eq('id', campaign.id);
          return response({ error: 'Could not save campaign audience' }, 500, origin);
        }
      }
      await admin.from('audit_logs').insert({ actor_id: user.id, action: 'campaign.created', entity_type: 'notification_campaign', entity_id: campaign.id, details: { channel, audience, recipients: recipients.length } });
      return response({ campaign }, 201, origin);
    } catch (error) {
      return response({ error: error instanceof Error ? error.message : 'Campaign creation failed' }, 500, origin);
    }
  }

  if (action === 'launch' || action === 'continue' || action === 'retry_failed') {
    const campaignId = String(input.campaignId ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return response({ error: 'A valid campaign is required' }, 400, origin);
    const { data: campaign, error } = await admin.from('notification_campaigns').select('*').eq('id', campaignId).maybeSingle();
    if (error || !campaign) return response({ error: 'Campaign not found' }, 404, origin);
    if (campaign.channel === 'sms' && smsTrialMode) return response({ error: 'This SMS campaign cannot be sent in Twilio trial mode. Use the profile SMS delivery check for a preset test message.' }, 403, origin);
    if ((campaign.channel === 'sms' && !twilioConfigured) || (campaign.channel === 'whatsapp' && !twilioConfigured)) return response({ error: 'Twilio is not configured' }, 503, origin);
    if (action === 'launch') {
      if (campaign.status !== 'draft') return response({ error: 'Only a draft campaign can be launched' }, 409, origin);
      await admin.from('notification_campaigns').update({ status: 'sending', started_at: new Date().toISOString() }).eq('id', campaignId);
      await admin.from('audit_logs').insert({ actor_id: user.id, action: 'campaign.launched', entity_type: 'notification_campaign', entity_id: campaignId });
    } else if (campaign.status !== 'sending' && action !== 'retry_failed') {
      return response({ error: 'This campaign is not in progress' }, 409, origin);
    }
    if (campaign.channel === 'sms' && !Deno.env.get('TWILIO_SMS_FROM')) return response({ error: 'SMS sender is not configured' }, 503, origin);
    if (campaign.channel === 'whatsapp' && (!Deno.env.get('TWILIO_WHATSAPP_FROM') || !Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID'))) {
      return response({ error: 'WhatsApp sender or approved template is not configured' }, 503, origin);
    }

    if (action === 'retry_failed') {
      await admin.from('campaign_recipients').update({ status: 'pending', error_code: null }).eq('campaign_id', campaignId).eq('status', 'failed');
      await admin.from('notification_campaigns').update({ status: 'sending', completed_at: null }).eq('id', campaignId);
    }
    const { data: recipients, error: recipientsError } = await admin.from('campaign_recipients')
      .select('id,user_id').eq('campaign_id', campaignId).eq('status', 'pending').order('created_at').limit(25);
    if (recipientsError) return response({ error: 'Could not load the next recipient batch' }, 500, origin);

    let attempted = 0;
    for (const recipient of recipients ?? []) {
      attempted++;
      const { data: profile } = await admin.from('profiles').select('phone,phone_verified,whatsapp_opt_in,sms_opt_in,role')
        .eq('id', recipient.user_id).maybeSingle();
      const optedIn = campaign.channel === 'whatsapp' ? profile?.whatsapp_opt_in : profile?.sms_opt_in;
      const to = cleanPhone(profile?.phone ?? null);
      if (!profile || profile.role !== 'candidate' || !optedIn || (campaign.channel === 'whatsapp' && !profile.phone_verified) || !/^\+[1-9]\d{7,14}$/.test(to)) {
        await admin.from('campaign_recipients').update({ status: 'suppressed', error_code: 'consent_or_phone_missing', updated_at: new Date().toISOString() }).eq('id', recipient.id);
        continue;
      }
      const payload = new URLSearchParams({ To: campaign.channel === 'whatsapp' ? 'whatsapp:' + to : to, From: campaign.channel === 'whatsapp' ? Deno.env.get('TWILIO_WHATSAPP_FROM')! : Deno.env.get('TWILIO_SMS_FROM')! });
      payload.set('StatusCallback', url + '/functions/v1/messaging-webhooks');
      if (campaign.channel === 'whatsapp') {
        payload.set('ContentSid', Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID')!);
        payload.set('ContentVariables', JSON.stringify({ '1': campaign.message }));
      } else {
        payload.set('Body', campaign.message);
        const dltEntity = Deno.env.get('TWILIO_SMS_DLT_ENTITY_ID');
        const dltTemplate = Deno.env.get('TWILIO_SMS_DLT_TEMPLATE_ID');
        if (dltEntity) payload.set('EntityId', dltEntity);
        if (dltTemplate) payload.set('DltTemplateId', dltTemplate);
      }
      let recipientStatus = 'failed';
      let providerMessageId: string | null = null;
      let errorCode: string | null = null;
      try {
        const sent = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + Deno.env.get('TWILIO_ACCOUNT_SID') + '/Messages.json', {
          method: 'POST',
          headers: { Authorization: 'Basic ' + btoa(Deno.env.get('TWILIO_ACCOUNT_SID') + ':' + Deno.env.get('TWILIO_AUTH_TOKEN')), 'Content-Type': 'application/x-www-form-urlencoded' },
          body: payload,
        });
        if (sent.ok) {
          const result = await sent.json();
          recipientStatus = 'sent';
          providerMessageId = result.sid ?? null;
        } else {
          const result = await sent.json().catch(() => ({}));
          errorCode = String(result.code ?? 'provider_rejected').slice(0, 80);
        }
      } catch { errorCode = 'provider_unavailable'; }
      await admin.from('campaign_recipients').update({
        status: recipientStatus, provider_message_id: providerMessageId, error_code: errorCode, updated_at: new Date().toISOString(),
      }).eq('id', recipient.id);
      if (providerMessageId) {
        await admin.from('notification_log').insert({
          user_id: recipient.user_id, channel: campaign.channel, event_key: 'campaign:' + campaignId + ':' + recipient.user_id,
          reference_id: campaignId, provider: 'twilio', provider_message_id: providerMessageId, status: 'sent',
        });
      }
    }
    const { data: allRows } = await admin.from('campaign_recipients').select('status').eq('campaign_id', campaignId);
    const statuses = allRows ?? [];
    const sentCount = statuses.filter((row) => ['sent', 'delivered'].includes(row.status)).length;
    const failedCount = statuses.filter((row) => ['failed', 'undelivered'].includes(row.status)).length;
    const pendingCount = statuses.filter((row) => row.status === 'pending').length;
    const nextStatus = pendingCount ? 'sending' : failedCount ? (sentCount ? 'partial' : 'failed') : 'completed';
    await admin.from('notification_campaigns').update({
      sent_count: sentCount, failed_count: failedCount, status: nextStatus,
      completed_at: pendingCount ? null : new Date().toISOString(),
    }).eq('id', campaignId);
    const { data: updated } = await admin.from('notification_campaigns').select('*').eq('id', campaignId).single();
    return response({ campaign: updated, attempted, remaining: pendingCount }, 200, origin);
  }

  return response({ error: 'Unsupported action' }, 400, origin);
});

