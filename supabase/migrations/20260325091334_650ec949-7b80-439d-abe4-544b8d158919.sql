
-- Allow first admin bootstrap: if no admins exist, any authenticated user can make themselves admin
CREATE POLICY "First admin bootstrap"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  AND user_id = auth.uid()
  AND role = 'admin'
);
