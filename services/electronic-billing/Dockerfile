FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first with just the .csproj files so this layer caches across
# builds that only change source code.
COPY src/CentrosIntegrales.Billing.Domain/CentrosIntegrales.Billing.Domain.csproj src/CentrosIntegrales.Billing.Domain/
COPY src/CentrosIntegrales.Billing.Infrastructure/CentrosIntegrales.Billing.Infrastructure.csproj src/CentrosIntegrales.Billing.Infrastructure/
COPY src/CentrosIntegrales.Billing.Api/CentrosIntegrales.Billing.Api.csproj src/CentrosIntegrales.Billing.Api/
RUN dotnet restore src/CentrosIntegrales.Billing.Api/CentrosIntegrales.Billing.Api.csproj

COPY src/ src/
RUN dotnet publish src/CentrosIntegrales.Billing.Api/CentrosIntegrales.Billing.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "CentrosIntegrales.Billing.Api.dll"]
