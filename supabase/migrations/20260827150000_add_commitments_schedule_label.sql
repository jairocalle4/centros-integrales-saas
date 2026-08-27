-- Guarda el horario específico propuesto (ej. "Lunes a Viernes, de 08:00
-- a 13:00") para servicios en modalidad Continua ("Servicio Mensual"), de
-- forma que el Acta de Compromiso lo muestre igual al crearse que al
-- reimprimirse después desde la ficha del beneficiario — siempre el
-- horario real de esa inscripción, nunca uno genérico o de otra.
ALTER TABLE public.commitments
  ADD COLUMN IF NOT EXISTS schedule_label text;
