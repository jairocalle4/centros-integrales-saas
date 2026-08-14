-- Migración para sincronizar usuarios de auth.users con public.profiles

BEGIN;

-- 1. Crear la función del trigger que insertará en public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    new.id,
    -- Extraer el first_name de los metadatos si existe, o usar un default
    COALESCE(new.raw_user_meta_data->>'first_name', 'Usuario'),
    -- Extraer el last_name de los metadatos si existe, o usar un default
    COALESCE(new.raw_user_meta_data->>'last_name', 'Sistema')
  );
  RETURN new;
END;
$$;

-- 2. Crear el trigger en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. (Opcional pero recomendado) Insertar perfiles retroactivamente para usuarios que ya existen 
-- y que por alguna razón no tengan perfil (como el superadmin que creó el usuario manual).
INSERT INTO public.profiles (id, first_name, last_name)
SELECT id, 'Super', 'Administrador'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

COMMIT;
