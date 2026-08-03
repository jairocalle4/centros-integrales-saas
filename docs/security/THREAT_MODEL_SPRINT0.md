# Threat Model (Sprint 0)

1. **Ataque de salto de tenant:** Un usuario autenticado en la Organización A intenta leer o modificar datos de la Organización B.
   - *Mitigación:* Se implementa RLS en la base de datos Supabase, validando `auth.uid()` con la tabla `organization_members`.
2. **Exposición accidental de secretos:** Los `.env` o certificados se suben a Git o se logean.
   - *Mitigación:* Estricta política `SECRETS_POLICY.md` y uso de `.gitignore`. CI escaneará los commits.
3. **Escalamiento de Privilegios:** Un usuario con rol `Staff` se otorga a sí mismo el rol `Owner`.
   - *Mitigación:* La función RPC encargada de invitar y cambiar roles se ejecuta con `SECURITY DEFINER` de manera controlada y chequea estrictamente si el invocador tiene los permisos requeridos ANTES de alterar las tablas.
