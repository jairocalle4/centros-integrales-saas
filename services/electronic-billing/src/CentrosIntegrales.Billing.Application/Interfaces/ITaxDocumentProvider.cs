namespace CentrosIntegrales.Billing.Application.Interfaces;

public interface ITaxDocumentProvider
{
    Task<string> EmitDocumentAsync(object documentData, string organizationId, CancellationToken cancellationToken = default);
}
