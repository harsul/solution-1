using System.Net;

namespace AspireApp1.Server.xIntegration;

public class SpaFallbackTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [InlineData("/signin")]
    [InlineData("/register")]
    [InlineData("/reports/2026?range=week")]
    public async Task Client_routes_are_served_the_React_app(string path)
    {
        var client = factory.CreateHttpsClient();

        var response = await client.GetAsync(path, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains(ServerFactory.IndexHtmlMarker, await response.Content.ReadAsStringAsync(Ct));
    }

    [Theory]
    [InlineData("/api/does-not-exist")]
    [InlineData("/api/auth/does-not-exist")]
    public async Task Unknown_api_routes_stay_404(string path)
    {
        var client = factory.CreateHttpsClient();

        var response = await client.GetAsync(path, Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.DoesNotContain(ServerFactory.IndexHtmlMarker, await response.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task Missing_static_files_stay_404()
    {
        var client = factory.CreateHttpsClient();

        var response = await client.GetAsync("/assets/missing.js", Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
