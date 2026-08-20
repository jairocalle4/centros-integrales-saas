namespace CentrosIntegrales.Billing.Domain.Models;

// Datos mínimos de un comprobante ya autorizado por el SRI (la autorización
// en sí ocurre en el servicio de facturación reutilizado — este microservicio
// solo genera el RIDE a partir del resultado).
public class AuthorizedElectronicDocument
{
    public required string AccessKey { get; set; }
    public string? AuthorizationNumber { get; set; }
    public DateTime? AuthorizationDate { get; set; }
}
