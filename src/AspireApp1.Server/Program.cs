using AspireApp1.Server;
using AspireApp1.Server.Auth;
using AspireApp1.Server.Data;
using AspireApp1.Server.Email;
using AspireApp1.Server.Endpoints;
using AspireApp1.Server.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();
builder.AddRedisClientBuilder("cache")
    .WithOutputCache();
builder.AddNpgsqlDbContext<AppDbContext>("appdb");

// Add services to the container.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.AddAppIdentity();
builder.AddAppEmail();
builder.AddAppRateLimiting();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    await app.MigrateDatabaseAsync();
}

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseOutputCache();

app.MapAuthEndpoints();
app.MapPasswordEndpoints();
app.MapWeatherEndpoints();

app.MapDefaultEndpoints();

app.UseFileServer();

// The React app (served from wwwroot when published) owns all other paths, e.g. /signin or a
// bookmarked deep link: serve index.html for them. Unknown /api routes stay a plain 404.
app.MapFallback("/api/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html");

app.Run();

// Makes Program visible to WebApplicationFactory<Program> in the integration tests.
public partial class Program;
