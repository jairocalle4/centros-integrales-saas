using CentrosIntegrales.Billing.Domain.Contracts;
using CentrosIntegrales.Billing.Domain.Enums;
using CentrosIntegrales.Billing.Domain.Interfaces;
using CentrosIntegrales.Billing.Domain.Models;
using CentrosIntegrales.Billing.Infrastructure.Pdf;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

// ── Configuration (env var only — never committed) ──
var rideServiceApiKey = builder.Configuration["RIDE_SERVICE_API_KEY"];

builder.Services.AddSingleton<IRideGenerator, RidePdfGenerator>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", version = "1.0" }))
   .WithName("HealthCheck");

// Genera el RIDE (PDF+QR) de un comprobante ya autorizado por el SRI. La
// autorización real (XML, firma XAdES-BES, SOAP) ocurre en el servicio de
// facturación reutilizado (open-api-facturacion-sri); este endpoint solo
// recibe el resultado ya autorizado y lo convierte en PDF. Llamado
// únicamente por el Edge Function de Supabase, nunca por el navegador —
// de ahí el shared secret, igual que el resto de este servicio.
app.MapPost("/api/v1/ride/generate", (HttpRequest httpRequest, RideGenerationRequest request, IRideGenerator rideGenerator) =>
{
    if (string.IsNullOrEmpty(rideServiceApiKey))
    {
        return Results.Problem("RIDE_SERVICE_API_KEY no está configurada en el servicio.", statusCode: 500);
    }
    if (!httpRequest.Headers.TryGetValue("X-Billing-Api-Key", out var providedKey) || providedKey != rideServiceApiKey)
    {
        return Results.Unauthorized();
    }

    byte[]? logoBytes = null;
    if (!string.IsNullOrEmpty(request.LogoBase64))
    {
        try
        {
            logoBytes = Convert.FromBase64String(request.LogoBase64);
        }
        catch (FormatException)
        {
            return Results.BadRequest(new { error = "El logo enviado no es un base64 válido." });
        }
    }

    var document = new AuthorizedElectronicDocument
    {
        AccessKey = request.AccessKey,
        AuthorizationNumber = request.AuthorizationNumber,
        AuthorizationDate = request.AuthorizationDate,
    };

    // "01"/"04" — mismo formato de 2 dígitos que ya usa sri_documents.document_type
    // en Supabase, para no mantener una tabla de mapeo separada.
    var documentType = request.DocumentType == "04" ? DocumentType.CreditNote : DocumentType.Invoice;

    var pdfBytes = rideGenerator.GenerateRidePdf(document, request.Issuer, request.Customer, request.Lines, request.Payments, logoBytes, documentType, request.ModifiedDocument);
    return Results.File(pdfBytes, "application/pdf", $"RIDE-{request.AccessKey}.pdf");
})
.WithName("GenerateRide");

app.Run();

public partial class Program { }

public class RideGenerationRequest
{
    [JsonPropertyName("accessKey")]
    public required string AccessKey { get; set; }
    [JsonPropertyName("authorizationNumber")]
    public string? AuthorizationNumber { get; set; }
    [JsonPropertyName("authorizationDate")]
    public DateTime? AuthorizationDate { get; set; }
    [JsonPropertyName("issuer")]
    public required IssuerData Issuer { get; set; }
    [JsonPropertyName("customer")]
    public required CustomerData Customer { get; set; }
    [JsonPropertyName("lines")]
    public required List<InvoiceLine> Lines { get; set; }
    [JsonPropertyName("payments")]
    public required List<PaymentDetail> Payments { get; set; }
    [JsonPropertyName("logoBase64")]
    public string? LogoBase64 { get; set; }
    [JsonPropertyName("documentType")]
    public string DocumentType { get; set; } = "01"; // "01" factura (default), "04" nota de crédito
    [JsonPropertyName("modifiedDocument")]
    public ModifiedDocumentData? ModifiedDocument { get; set; }
}
