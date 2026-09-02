namespace CentrosIntegrales.Billing.Domain.Enums;

public enum SriEnvironment
{
    Test = 1,
    Production = 2
}

public enum IdentificationType
{
    Ruc = 4,
    Cedula = 5,
    Passport = 6,
    FinalConsumer = 7
}

public enum TaxType
{
    Iva = 2,
    Ice = 3,
    Irbpnr = 5
}

public enum PaymentMethod
{
    SinUtilizacionSistemaFinanciero = 1,
    CompensacionDeDudas = 15,
    TarjetaDeDebito = 16,
    DineroElectronico = 17,
    TarjetaPrepago = 18,
    TarjetaDeCredito = 19,
    OtrosConUtilizacionSistemaFinanciero = 20,
    EndosoDeCheques = 21
}

// Tipo de comprobante SRI que se está renderizando en el RIDE — hoy solo
// Factura y Nota de Crédito tienen soporte real (Nota de Débito, Guía de
// Remisión y Retención no están implementadas en ningún punto del
// sistema todavía).
public enum DocumentType
{
    Invoice,     // Factura, código SRI '01'
    CreditNote,  // Nota de Crédito, código SRI '04'
}
