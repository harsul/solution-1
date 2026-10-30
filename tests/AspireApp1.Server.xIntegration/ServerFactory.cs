using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using AspireApp1.Server.xIntegration.TestDoubles;

namespace AspireApp1.Server.xIntegration;

/// <summary>
/// Runs the server in memory against its own fresh PostgreSQL database on the shared
/// <see cref="PostgresFixture"/> server (migrations run at startup).
/// Redis is not available in tests, so the Redis-backed output cache is replaced with a store
/// that never caches. Logs are captured in <see cref="Logs"/>, and a test-only route at
/// <see cref="ThrowingEndpointStartupFilter.Path"/> always throws.
/// </summary>
public sealed class ServerFactory(PostgresFixture postgres) : WebApplicationFactory<Program>
{
    private readonly string _connectionString = postgres.NewDatabaseConnectionString();

    public TestLoggerProvider Logs { get; } = new();

    /// <summary>
    /// A client that talks HTTPS, so the Secure auth cookie is sent back on later requests.
    /// </summary>
    public HttpClient CreateHttpsClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:appdb", _connectionString);

        // Aspire's Redis client requires a connection string; it is never connected to.
        builder.UseSetting("ConnectionStrings:cache", "localhost:6379,abortConnect=false,connectTimeout=100");

        builder.ConfigureLogging(logging => logging.AddProvider(Logs));

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IOutputCacheStore>();
            services.AddSingleton<IOutputCacheStore, NoCacheOutputStore>();
            services.AddTransient<IStartupFilter, ThrowingEndpointStartupFilter>();
        });
    }

    private sealed class NoCacheOutputStore : IOutputCacheStore
    {
        public ValueTask EvictByTagAsync(string tag, CancellationToken cancellationToken) => ValueTask.CompletedTask;

        public ValueTask<byte[]?> GetAsync(string key, CancellationToken cancellationToken) => ValueTask.FromResult<byte[]?>(null);

        public ValueTask SetAsync(string key, byte[] value, string[]? tags, TimeSpan validFor, CancellationToken cancellationToken) => ValueTask.CompletedTask;
    }
}
