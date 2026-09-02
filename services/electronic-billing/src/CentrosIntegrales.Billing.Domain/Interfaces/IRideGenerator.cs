using CentrosIntegrales.Billing.Domain.Contracts;
using CentrosIntegrales.Billing.Domain.Enums;
using CentrosIntegrales.Billing.Domain.Models;

namespace CentrosIntegrales.Billing.Domain.Interfaces;

public interface IRideGenerator
{
    // documentType/modifiedDocument son opcionales con default Invoice/null
    // para no romper el caller y el test existentes, que solo conocen
    // Factura. modifiedDocument solo debe pasarse cuando documentType es
    // CreditNote.
    byte[] GenerateRidePdf(
        AuthorizedElectronicDocument document,
        IssuerData issuer,
        CustomerData customer,
        List<InvoiceLine> lines,
        List<PaymentDetail> payments,
        byte[]? logoBytes,
        DocumentType documentType = DocumentType.Invoice,
        ModifiedDocumentData? modifiedDocument = null);
}
