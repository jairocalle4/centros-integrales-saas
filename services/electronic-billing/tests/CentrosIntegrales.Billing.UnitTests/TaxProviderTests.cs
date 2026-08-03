using CentrosIntegrales.Billing.Infrastructure.Providers;

namespace CentrosIntegrales.Billing.UnitTests;

public class TaxProviderTests
{
    [Fact]
    public async Task EmitDocumentAsync_ThrowsNotImplementedException()
    {
        // Arrange
        var provider = new NotConfiguredTaxDocumentProvider();

        // Act & Assert
        await Assert.ThrowsAsync<NotImplementedException>(() => provider.EmitDocumentAsync(new object(), "org-1"));
    }
}
