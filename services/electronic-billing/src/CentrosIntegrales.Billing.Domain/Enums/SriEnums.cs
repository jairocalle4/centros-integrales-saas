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
