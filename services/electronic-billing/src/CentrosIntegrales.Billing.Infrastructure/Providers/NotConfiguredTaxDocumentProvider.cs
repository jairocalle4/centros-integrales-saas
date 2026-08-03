using CentrosIntegrales.Billing.Application.Interfaces;

namespace CentrosIntegrales.Billing.Infrastructure.Providers;

public class NotConfiguredTaxDocumentProvider : ITaxDocumentProvider
{
    public Task<string> EmitDocumentAsync(object documentData, string organizationId, CancellationToken cancellationToken = default)
    {
        throw new NotImplementedException("El proveedor de facturación electrónica SRI no está configurado para este entorno.");
    }
}
