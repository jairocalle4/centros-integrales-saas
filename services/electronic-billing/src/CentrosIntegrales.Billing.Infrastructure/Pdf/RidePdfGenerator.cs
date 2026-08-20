using CentrosIntegrales.Billing.Domain.Contracts;
using CentrosIntegrales.Billing.Domain.Enums;
using CentrosIntegrales.Billing.Domain.Interfaces;
using CentrosIntegrales.Billing.Domain.Models;
using QRCoder;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CentrosIntegrales.Billing.Infrastructure.Pdf;

public class RidePdfGenerator : IRideGenerator
{
    static RidePdfGenerator()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] GenerateRidePdf(AuthorizedElectronicDocument document, IssuerData issuer, CustomerData customer, List<InvoiceLine> lines, List<PaymentDetail> payments, byte[]? logoBytes)
    {
        var qrCodeBytes = GenerateQrCodeBytes(document.AccessKey ?? string.Empty);
        var accessKeyFormatted = FormatAccessKey(document.AccessKey ?? string.Empty);

        var pdfDoc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(20);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                page.Header().Element(headerContainer =>
                {
                    headerContainer.Row(row =>
                    {
                        // Left column: Issuer & Logo
                        row.RelativeItem(5).Column(col =>
                        {
                            if (logoBytes != null && logoBytes.Length > 0)
                            {
                                col.Item().MaxHeight(60).MaxWidth(180).Image(logoBytes);
                                col.Item().PaddingBottom(5);
                            }

                            col.Item().Text(issuer.SocialReason).Bold().FontSize(12);
                            if (!string.IsNullOrEmpty(issuer.CommercialName))
                            {
                                col.Item().Text($"Nombre Comercial: {issuer.CommercialName}").FontSize(9);
                            }
                            col.Item().Text($"Matriz: {issuer.MainAddress}").FontSize(8);
                            col.Item().Text($"Establecimiento: {issuer.MainAddress}").FontSize(8);
                            col.Item().Text($"Obligado a llevar contabilidad: {(issuer.IsObligedToKeepAccounts ? "SI" : "NO")}").FontSize(8);
                            if (!string.IsNullOrEmpty(issuer.RimpeType))
                            {
                                col.Item().Text(issuer.RimpeType).Bold().FontSize(8);
                            }
                        });

                        row.ConstantItem(10);

                        // Right column: Invoice header box
                        row.RelativeItem(5).Border(1).BorderColor(Colors.Grey.Lighten1).Padding(10).Column(col =>
                        {
                            col.Item().Text($"R.U.C.: {issuer.Ruc}").Bold().FontSize(11);
                            col.Item().Text("FACTURA").Bold().FontSize(14);
                            col.Item().Text($"No. {document.AccessKey?.Substring(24, 3)}-{document.AccessKey?.Substring(27, 3)}-{document.AccessKey?.Substring(30, 9)}").FontSize(10);
                            col.Item().Text($"NÚMERO DE AUTORIZACIÓN:").Bold().FontSize(8);
                            col.Item().Text(document.AuthorizationNumber ?? document.AccessKey).FontSize(7);
                            col.Item().Text($"FECHA Y HORA DE AUTORIZACIÓN: {document.AuthorizationDate?.ToString("dd/MM/yyyy HH:mm:ss") ?? DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss")}").FontSize(8);
                            col.Item().Text($"AMBIENTE: {(issuer.Environment == SriEnvironment.Production ? "PRODUCCIÓN" : "PRUEBAS")}").FontSize(8);
                            col.Item().Text($"EMISIÓN: NORMAL").FontSize(8);
                            col.Item().Text("CLAVE DE ACCESO:").Bold().FontSize(8);

                            if (qrCodeBytes != null && qrCodeBytes.Length > 0)
                            {
                                col.Item().AlignCenter().MaxHeight(50).Image(qrCodeBytes);
                            }
                            col.Item().Text(accessKeyFormatted).FontSize(7);
                        });
                    });
                });

                page.Content().PaddingVertical(10).Column(col =>
                {
                    // Customer info box
                    col.Item().Border(1).BorderColor(Colors.Grey.Lighten1).Padding(8).Column(c =>
                    {
                        c.Item().Row(r =>
                        {
                            r.RelativeItem(7).Text($"Razón Social / Nombres y Apellidos: {customer.SocialReason}").Bold();
                            r.RelativeItem(3).Text($"Identificación: {customer.IdentificationNumber}").Bold();
                        });
                        c.Item().Row(r =>
                        {
                            r.RelativeItem(7).Text($"Fecha Emisión: {document.AuthorizationDate?.ToString("dd/MM/yyyy") ?? DateTime.Now.ToString("dd/MM/yyyy")}");
                            r.RelativeItem(3).Text($"Dirección: {customer.Address}");
                        });
                    });

                    col.Item().PaddingVertical(10);

                    // Lines Table
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(60);
                            columns.ConstantColumn(50);
                            columns.RelativeColumn(4);
                            columns.ConstantColumn(60);
                            columns.ConstantColumn(60);
                            columns.ConstantColumn(60);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(4).Text("Cod. Principal").Bold().FontSize(8);
                            header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(4).Text("Cant").Bold().FontSize(8);
                            header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(4).Text("Descripción").Bold().FontSize(8);
                            header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(4).Text("Precio Unit").Bold().FontSize(8);
                            header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(4).Text("Descuento").Bold().FontSize(8);
                            header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(4).Text("Precio Total").Bold().FontSize(8);
                        });

                        foreach (var line in lines)
                        {
                            table.Cell().Border(1).Padding(4).Text(line.ItemCode).FontSize(8);
                            table.Cell().Border(1).Padding(4).Text(line.Quantity.ToString("F2")).FontSize(8);
                            table.Cell().Border(1).Padding(4).Text(line.Description).FontSize(8);
                            table.Cell().Border(1).Padding(4).Text(line.UnitPrice.ToString("F4")).FontSize(8);
                            table.Cell().Border(1).Padding(4).Text(line.Discount.ToString("F2")).FontSize(8);
                            table.Cell().Border(1).Padding(4).Text(line.Subtotal.ToString("F2")).FontSize(8);
                        }
                    });

                    col.Item().PaddingVertical(10);

                    // Totals and Payments row
                    col.Item().Row(r =>
                    {
                        // Additional Info & Payments
                        r.RelativeItem(6).Column(c =>
                        {
                            if (!string.IsNullOrEmpty(customer.Email))
                            {
                                c.Item().Border(1).Padding(5).Column(ac =>
                                {
                                    ac.Item().Text("INFORMACIÓN ADICIONAL").Bold().FontSize(8);
                                    ac.Item().Text($"Email: {customer.Email}").FontSize(8);
                                    if (!string.IsNullOrEmpty(customer.Phone)) ac.Item().Text($"Teléfono: {customer.Phone}").FontSize(8);
                                });
                            }

                            c.Item().PaddingVertical(5);

                            c.Item().Text("FORMA DE PAGO").Bold().FontSize(8);
                            c.Item().Table(ptable =>
                            {
                                ptable.ColumnsDefinition(pcols =>
                                {
                                    pcols.RelativeColumn(7);
                                    pcols.RelativeColumn(3);
                                });
                                ptable.Header(ph =>
                                {
                                    ph.Cell().Border(1).Padding(3).Text("Forma Pago").Bold().FontSize(8);
                                    ph.Cell().Border(1).Padding(3).Text("Valor").Bold().FontSize(8);
                                });
                                foreach (var p in payments)
                                {
                                    ptable.Cell().Border(1).Padding(3).Text("SIN UTILIZACION DEL SISTEMA FINANCIERO").FontSize(8);
                                    ptable.Cell().Border(1).Padding(3).Text(p.Total.ToString("F2")).FontSize(8);
                                }
                            });
                        });

                        r.ConstantItem(10);

                        // Totals table
                        r.RelativeItem(4).Table(ttable =>
                        {
                            ttable.ColumnsDefinition(tcols =>
                            {
                                tcols.RelativeColumn(7);
                                tcols.RelativeColumn(3);
                            });

                            var subtotalWithoutTax = Math.Round(lines.Sum(l => l.Subtotal), 2);
                            var totalDiscount = Math.Round(lines.Sum(l => l.Discount), 2);
                            var totalTax = Math.Round(lines.SelectMany(l => l.Taxes).Sum(t => t.TaxAmount), 2);
                            var totalAmount = subtotalWithoutTax + totalTax;

                            // One "SUBTOTAL <rate>%" row per tax rate actually present in
                            // the lines — not hardcoded to 15%, which would mislabel a
                            // 0%-rated invoice (or any other rate) with the wrong amounts.
                            var rateGroups = lines
                                .SelectMany(l => l.Taxes)
                                .GroupBy(t => t.Rate)
                                .Select(g => new { Rate = g.Key, TaxableBase = Math.Round(g.Sum(t => t.TaxableBase), 2) })
                                .OrderByDescending(g => g.Rate);

                            foreach (var rg in rateGroups)
                            {
                                AddTotalRow(ttable, $"SUBTOTAL {rg.Rate:F0}%", rg.TaxableBase.ToString("F2"));
                            }
                            AddTotalRow(ttable, "SUBTOTAL SIN IMPUESTOS", subtotalWithoutTax.ToString("F2"));
                            AddTotalRow(ttable, "TOTAL DESCUENTO", totalDiscount.ToString("F2"));
                            AddTotalRow(ttable, "IVA", totalTax.ToString("F2"));
                            AddTotalRow(ttable, "VALOR TOTAL", totalAmount.ToString("F2"), isBold: true);
                        });
                    });
                });
            });
        });

        return pdfDoc.GeneratePdf();
    }

    private static void AddTotalRow(TableDescriptor table, string label, string value, bool isBold = false)
    {
        var cellLabel = table.Cell().Border(1).Padding(3).Text(label).FontSize(8);
        if (isBold) cellLabel.Bold();

        var cellValue = table.Cell().Border(1).Padding(3).AlignRight().Text(value).FontSize(8);
        if (isBold) cellValue.Bold();
    }

    private static byte[]? GenerateQrCodeBytes(string text)
    {
        if (string.IsNullOrEmpty(text)) return null;
        try
        {
            using var qrGenerator = new QRCodeGenerator();
            using var qrData = qrGenerator.CreateQrCode(text, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new PngByteQRCode(qrData);
            return qrCode.GetGraphic(4);
        }
        catch
        {
            return null;
        }
    }

    private static string FormatAccessKey(string key)
    {
        if (string.IsNullOrEmpty(key) || key.Length != 49) return key;
        return $"{key.Substring(0, 8)} {key.Substring(8, 2)} {key.Substring(10, 13)} {key.Substring(23, 1)} {key.Substring(24, 6)} {key.Substring(30, 9)} {key.Substring(39, 8)} {key.Substring(47, 2)}";
    }
}
