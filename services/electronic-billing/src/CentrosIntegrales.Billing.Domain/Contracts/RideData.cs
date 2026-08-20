using CentrosIntegrales.Billing.Domain.Enums;

namespace CentrosIntegrales.Billing.Domain.Contracts;

public class IssuerData
{
    public required string Ruc { get; set; }
    public required string SocialReason { get; set; }
    public string? CommercialName { get; set; }
    public required string MainAddress { get; set; }
    public bool IsObligedToKeepAccounts { get; set; } = false;
    public string? RimpeType { get; set; } // e.g. "CONTRIBUYENTE RÉGIMEN RIMPE" o "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE"
    public SriEnvironment Environment { get; set; } = SriEnvironment.Test;
}

public class CustomerData
{
    public required IdentificationType IdentificationType { get; set; }
    public required string IdentificationNumber { get; set; }
    public required string SocialReason { get; set; }
    public required string Address { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
}

public class InvoiceLine
{
    public required string ItemCode { get; set; }
    public string? AuxiliaryCode { get; set; }
    public required string Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Discount { get; set; } = 0m;
    public decimal Subtotal => Math.Round((Quantity * UnitPrice) - Discount, 2, MidpointRounding.AwayFromZero);
    public required List<TaxDetail> Taxes { get; set; } = new();
}

public class TaxDetail
{
    public TaxType TaxType { get; set; } = TaxType.Iva;
    public required string PercentageCode { get; set; } // "4" = 15%, "2" = 12%, "0" = 0%
    public decimal Rate { get; set; } // 15, 12, 0
    public decimal TaxableBase { get; set; }
    public decimal TaxAmount => Math.Round(TaxableBase * (Rate / 100m), 2, MidpointRounding.AwayFromZero);
}

public class PaymentDetail
{
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.SinUtilizacionSistemaFinanciero;
    public decimal Total { get; set; }
    public int TimeLimit { get; set; } = 0;
    public string TimeUnit { get; set; } = "dias";
}
