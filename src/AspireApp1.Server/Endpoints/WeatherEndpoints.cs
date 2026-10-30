namespace AspireApp1.Server.Endpoints;

internal static class WeatherEndpoints
{
    private static readonly string[] Summaries =
        ["Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"];

    public static IEndpointRouteBuilder MapWeatherEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/weatherforecast", () =>
                Enumerable.Range(1, 5).Select(index => new WeatherForecast(
                        DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
                        Random.Shared.Next(-20, 55),
                        Summaries[Random.Shared.Next(Summaries.Length)]))
                    .ToArray())
            .CacheOutput(p => p.Expire(TimeSpan.FromSeconds(5)))
            .WithName("GetWeatherForecast")
            .RequireAuthorization();

        return app;
    }
}

internal record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
