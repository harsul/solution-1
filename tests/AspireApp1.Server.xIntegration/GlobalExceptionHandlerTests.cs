using System.Net;
using System.Text.Json;
using AspireApp1.Server.xIntegration.TestDoubles;
using Microsoft.Extensions.Logging;

namespace AspireApp1.Server.xIntegration;

public class GlobalExceptionHandlerTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    [Fact]
    public async Task Unhandled_exception_returns_500_problem_details()
    {
        var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(ThrowingEndpointStartupFilter.Path, ct);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var body = await response.Content.ReadAsStringAsync(ct);
        Assert.DoesNotContain(ThrowingEndpointStartupFilter.SecretMessage, body);

        using var json = JsonDocument.Parse(body);
        Assert.Equal(500, json.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("An unexpected error occurred", json.RootElement.GetProperty("title").GetString());
        Assert.True(json.RootElement.TryGetProperty("traceId", out _), "Response should include a traceId for correlation.");
    }

    [Fact]
    public async Task Unhandled_exception_is_logged_by_the_handler()
    {
        var client = factory.CreateClient();

        await client.GetAsync(ThrowingEndpointStartupFilter.Path, TestContext.Current.CancellationToken);

        Assert.Contains(factory.Logs.Entries, entry =>
            entry.Category.EndsWith(".GlobalExceptionHandler")
            && entry.Level == LogLevel.Error
            && entry.Exception is InvalidOperationException
            && entry.Message.Contains(ThrowingEndpointStartupFilter.Path));
    }
}
