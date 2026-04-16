-- Important items: documents, instructions, and links
CREATE TABLE IF NOT EXISTS public.important_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL CHECK (type IN ('document', 'instruction', 'link')),
  title        text NOT NULL,
  body         text,          -- instructions: full markdown text
  url          text,          -- links: target URL; documents: storage path
  file_name    text,          -- documents: original filename
  file_size    bigint,        -- documents: bytes
  file_mime    text,          -- documents: MIME type
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_important_items_updated_at
  BEFORE UPDATE ON public.important_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.important_items ENABLE ROW LEVEL SECURITY;

-- Owners: full access
CREATE POLICY "owner_all_important_items" ON public.important_items
  FOR ALL USING (get_my_role() = 'owner');

-- Employees: read only
CREATE POLICY "employee_read_important_items" ON public.important_items
  FOR SELECT USING (get_my_role() = 'employee');
