-- ── Leads from the public quote form ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  phone            text NOT NULL,
  email            text,
  address          text NOT NULL,
  preferred_date   date,
  status           text NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new', 'quoted', 'converted', 'lost')),
  property_data    jsonb,        -- raw Apify / lookup response
  lot_size_sqft    numeric,
  quoted_amount    numeric,
  quote_sent_at    timestamptz,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_leads" ON public.leads FOR ALL USING (get_my_role() = 'owner');

-- ── Available mow dates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.availability_dates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  available_date date NOT NULL UNIQUE,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.availability_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_availability" ON public.availability_dates FOR ALL USING (get_my_role() = 'owner');

-- ── Conversations (one per phone number) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            text NOT NULL UNIQUE,
  lead_id          uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id      uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  display_name     text,
  ai_enabled       boolean NOT NULL DEFAULT true,
  ai_state         text NOT NULL DEFAULT 'quote_sent',
  last_message_at  timestamptz,
  unread_count     int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_conversations" ON public.conversations FOR ALL USING (get_my_role() = 'owner');

-- ── Individual messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction        text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body             text NOT NULL,
  twilio_sid       text,
  status           text,
  sent_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_messages_conv_id ON public.conversation_messages(conversation_id);
CREATE INDEX idx_conv_messages_sent_at ON public.conversation_messages(sent_at);

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_messages" ON public.conversation_messages FOR ALL USING (get_my_role() = 'owner');
