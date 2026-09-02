using CentrosIntegrales.Billing.Domain.Contracts;
using CentrosIntegrales.Billing.Domain.Enums;
using CentrosIntegrales.Billing.Domain.Models;
using CentrosIntegrales.Billing.Infrastructure.Pdf;

namespace CentrosIntegrales.Billing.UnitTests;

public class RidePdfGeneratorTests
{
    [Fact]
    public void GenerateRidePdf_WithAuthorizedDocument_ReturnsValidPdfBytes()
    {
        var generator = new RidePdfGenerator();

        var document = new AuthorizedElectronicDocument
        {
            AccessKey = "1234567890123456789012345678901234567890123456789",
            AuthorizationNumber = "1234567890123456789012345678901234567890123456789",
            AuthorizationDate = DateTime.UtcNow,
        };

        var issuer = new IssuerData
        {
            Ruc = "0924383631001",
            SocialReason = "CENTRO INTEGRAL DE PRUEBA",
            MainAddress = "Guayaquil",
            RimpeType = "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE",
            Environment = SriEnvironment.Test,
        };

        var customer = new CustomerData
        {
            IdentificationType = IdentificationType.Cedula,
            IdentificationNumber = "0926789017",
            SocialReason = "CLIENTE PRUEBA",
            Address = "Guayaquil",
        };

        var lines = new List<InvoiceLine>
        {
            new()
            {
                ItemCode = "SRV-001",
                Description = "Mensualidad",
                Quantity = 1,
                UnitPrice = 100m,
                Taxes = new List<TaxDetail>
                {
                    new() { PercentageCode = "0", Rate = 0m, TaxableBase = 100m },
                },
            },
        };

        var payments = new List<PaymentDetail> { new() { Total = 100m } };

        var pdfBytes = generator.GenerateRidePdf(document, issuer, customer, lines, payments, logoBytes: null);

        Assert.NotNull(pdfBytes);
        Assert.True(pdfBytes.Length > 0);
        // Firma mágica de un PDF válido.
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdfBytes, 0, 4));
    }

    [Fact]
    public void GenerateRidePdf_WithCreditNote_ReturnsValidPdfBytes()
    {
        var generator = new RidePdfGenerator();

        var document = new AuthorizedElectronicDocument
        {
            AccessKey = "1234567890123456789012345678904567890123456789012",
            AuthorizationNumber = "1234567890123456789012345678904567890123456789012",
            AuthorizationDate = DateTime.UtcNow,
        };

        var issuer = new IssuerData
        {
            Ruc = "0924383631001",
            SocialReason = "CENTRO INTEGRAL DE PRUEBA",
            MainAddress = "Guayaquil",
            RimpeType = "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE",
            Environment = SriEnvironment.Test,
        };

        var customer = new CustomerData
        {
            IdentificationType = IdentificationType.Cedula,
            IdentificationNumber = "0926789017",
            SocialReason = "CLIENTE PRUEBA",
            Address = "Guayaquil",
        };

        var lines = new List<InvoiceLine>
        {
            new()
            {
                ItemCode = "SRV-001",
                Description = "Mensualidad",
                Quantity = 1,
                UnitPrice = 100m,
                Taxes = new List<TaxDetail>
                {
                    new() { PercentageCode = "0", Rate = 0m, TaxableBase = 100m },
                },
            },
        };

        var payments = new List<PaymentDetail> { new() { Total = 100m } };

        var modifiedDocument = new ModifiedDocumentData
        {
            DocumentNumber = "001-001-000000123",
            IssueDate = DateTime.UtcNow.AddDays(-10),
            Reason = "Anulación por inscripción duplicada",
        };

        var pdfBytes = generator.GenerateRidePdf(
            document, issuer, customer, lines, payments, logoBytes: null,
            documentType: DocumentType.CreditNote, modifiedDocument: modifiedDocument);

        Assert.NotNull(pdfBytes);
        Assert.True(pdfBytes.Length > 0);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdfBytes, 0, 4));
    }
}
