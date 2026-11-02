-- Profile plan and identity fields are managed by trusted server-side flows.
-- The signup trigger runs as SECURITY DEFINER and continues to create rows.
-- The client currently only needs to read its own profile.
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

-- Sharing a project must not silently publish its private AI conversation or
-- prompts, which can contain source excerpts or accidentally pasted secrets.
DROP POLICY IF EXISTS "select_shared_messages" ON public.ai_messages;
DROP POLICY IF EXISTS "select_shared_conversations" ON public.ai_conversations;

-- Pin the auth trigger to trusted objects instead of inheriting a caller's
-- search_path while it executes with elevated privileges.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;
