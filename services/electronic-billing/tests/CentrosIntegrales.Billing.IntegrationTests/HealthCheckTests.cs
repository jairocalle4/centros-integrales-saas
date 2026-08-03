using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CentrosIntegrales.Billing.IntegrationTests;

public class HealthCheckTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HealthCheckTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetHealth_ReturnsOkAndHealthyStatus()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/health");

        // Assert
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<HealthResponse>();

        Assert.NotNull(content);
        Assert.Equal("Healthy", content.status);
        Assert.Equal("1.0", content.version);
    }

    private class HealthResponse
    {
        public string? status { get; set; }
        public string? version { get; set; }
    }
}
