using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AspireApp1.Server.xIntegration;

/// <summary>
/// Runs the server in memory. Redis is not available in tests, so the
/// Redis-backed output cache is replaced with a store that never caches.
/// </summary>
public sealed class ServerFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Aspire's Redis client requires a connection string; it is never connected to.
        builder.UseSetting("ConnectionStrings:cache", "localhost:6379,abortConnect=false,connectTimeout=100");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IOutputCacheStore>();
            services.AddSingleton<IOutputCacheStore, NoCacheOutputStore>();
        });
    }

    private sealed class NoCacheOutputStore : IOutputCacheStore
    {
        public ValueTask EvictByTagAsync(string tag, CancellationToken cancellationToken) => ValueTask.CompletedTask;

        public ValueTask<byte[]?> GetAsync(string key, CancellationToken cancellationToken) => ValueTask.FromResult<byte[]?>(null);

        public ValueTask SetAsync(string key, byte[] value, string[]? tags, TimeSpan validFor, CancellationToken cancellationToken) => ValueTask.CompletedTask;
    }
}
