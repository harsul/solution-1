using Microsoft.EntityFrameworkCore;

namespace AspireApp1.Server.Data;

internal static class DatabaseExtensions
{
    /// <summary>Applies pending EF Core migrations. Only called in Development.</summary>
    public static async Task MigrateDatabaseAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }
}
