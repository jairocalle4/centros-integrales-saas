using CentrosIntegrales.Billing.Domain.Contracts;
using CentrosIntegrales.Billing.Domain.Models;

namespace CentrosIntegrales.Billing.Domain.Interfaces;

public interface IRideGenerator
{
    byte[] GenerateRidePdf(AuthorizedElectronicDocument document, IssuerData issuer, CustomerData customer, List<InvoiceLine> lines, List<PaymentDetail> payments, byte[]? logoBytes);
}
