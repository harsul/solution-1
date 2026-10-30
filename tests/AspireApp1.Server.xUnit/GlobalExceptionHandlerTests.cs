using System.Text.Json;
using AspireApp1.Server.xUnit.TestDoubles;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AspireApp1.Server.xUnit;

public class GlobalExceptionHandlerTests
{
    private readonly TestLogger<GlobalExceptionHandler> _logger = new();
    private readonly GlobalExceptionHandler _handler;
    private readonly IServiceProvider _services;

    public GlobalExceptionHandlerTests()
    {
        // Real ProblemDetails infrastructure, no mocks.
        _services = new ServiceCollection()
            .AddLogging()
            .AddProblemDetails()
            .BuildServiceProvider();

        _handler = new GlobalExceptionHandler(
            _services.GetRequiredService<IProblemDetailsService>(),
            _logger);
    }

    [Fact]
    public async Task Unexpected_exception_returns_500_problem_details_without_exception_details()
    {
        var context = CreateHttpContext("GET", "/api/orders");
        var exception = new InvalidOperationException("Sensitive database detail");

        var handled = await _handler.TryHandleAsync(context, exception, TestContext.Current.CancellationToken);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        Assert.StartsWith("application/problem+json", context.Response.ContentType);

        var body = await ReadBodyAsync(context);
        Assert.DoesNotContain("Sensitive database detail", body);

        using var json = JsonDocument.Parse(body);
        Assert.Equal(500, json.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("An unexpected error occurred", json.RootElement.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Unexpected_exception_is_logged_as_error_with_request_info()
    {
        var context = CreateHttpContext("POST", "/api/orders");
        var exception = new InvalidOperationException("boom");

        await _handler.TryHandleAsync(context, exception, TestContext.Current.CancellationToken);

        var entry = Assert.Single(_logger.Entries);
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.Same(exception, entry.Exception);
        Assert.Contains("POST", entry.Message);
        Assert.Contains("/api/orders", entry.Message);
    }

    [Fact]
    public async Task Bad_request_exception_returns_its_status_code_and_logs_a_warning()
    {
        var context = CreateHttpContext("POST", "/api/orders");
        var exception = new BadHttpRequestException("Invalid JSON", StatusCodes.Status400BadRequest);

        var handled = await _handler.TryHandleAsync(context, exception, TestContext.Current.CancellationToken);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        using var json = JsonDocument.Parse(await ReadBodyAsync(context));
        Assert.Equal("Bad request", json.RootElement.GetProperty("title").GetString());
        Assert.Equal(LogLevel.Warning, Assert.Single(_logger.Entries).Level);
    }

    private DefaultHttpContext CreateHttpContext(string method, string path)
    {
        var context = new DefaultHttpContext { RequestServices = _services };
        context.Request.Method = method;
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static async Task<string> ReadBodyAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        return await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
    }
}
