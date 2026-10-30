using System.Net;
using System.Net.Http.Json;
using AspireApp1.Server.xIntegration.TestDoubles;

namespace AspireApp1.Server.xIntegration;

public class WeatherForecastEndpointTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    private sealed record ForecastDto(DateOnly Date, int TemperatureC, int TemperatureF, string? Summary);

    [Fact]
    public async Task Get_returns_five_future_forecasts_when_signed_in()
    {
        var (client, _) = await AuthHelpers.SignedInClientAsync(factory);
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync("/api/weatherforecast", ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var forecasts = await response.Content.ReadFromJsonAsync<ForecastDto[]>(ct);
        Assert.NotNull(forecasts);
        Assert.Equal(5, forecasts.Length);
        var today = DateOnly.FromDateTime(DateTime.Now);
        Assert.All(forecasts, f =>
        {
            Assert.True(f.Date > today);
            Assert.InRange(f.TemperatureC, -20, 54);
            Assert.False(string.IsNullOrWhiteSpace(f.Summary));
        });
    }

    [Fact]
    public async Task Get_without_a_session_returns_401_not_a_redirect()
    {
        var client = factory.CreateHttpsClient();

        var response = await client.GetAsync("/api/weatherforecast", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
    }

    [Fact]
    public async Task Unknown_api_route_returns_404()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/does-not-exist", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
