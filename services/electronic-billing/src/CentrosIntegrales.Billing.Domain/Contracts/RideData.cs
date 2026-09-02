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
    // Asignado por el llamador (Edge Function), no recalculado aquí: el XML
    // ya autorizado por el SRI es la fuente de verdad del valor exacto del
    // IVA (base × tarifa puede redondear distinto que "total - base", que
    // es como se calculó ese valor originalmente) — recalcularlo de forma
    // independiente puede descuadrar el RIDE en ±1 centavo contra el XML
    // legal.
    public decimal TaxAmount { get; set; }
}

public class PaymentDetail
{
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.SinUtilizacionSistemaFinanciero;
    public decimal Total { get; set; }
    public int TimeLimit { get; set; } = 0;
    public string TimeUnit { get; set; } = "dias";
}

// Solo aplica a una Nota de Crédito (DocumentType.CreditNote): identifica
// la factura que esta nota modifica. El RIDE real de una nota de crédito
// debe mostrar este bloque; una Factura nunca lo lleva.
public class ModifiedDocumentData
{
    public required string DocumentNumber { get; set; } // ej. "001-001-000000123"
    public required DateTime IssueDate { get; set; }
    public required string Reason { get; set; } // motivo de la nota de crédito
}
