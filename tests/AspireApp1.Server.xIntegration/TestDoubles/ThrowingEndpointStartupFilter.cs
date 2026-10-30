using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace AspireApp1.Server.xIntegration.TestDoubles;

/// <summary>
/// Adds a test-only route at the end of the app's pipeline that always throws,
/// so the real exception handling middleware can be exercised end to end.
/// </summary>
public sealed class ThrowingEndpointStartupFilter : IStartupFilter
{
    // File-like on purpose: the app's SPA fallback (index.html) serves every non-file path that
    // no endpoint handles, so only a "file" path falls through to this test-only branch.
    public const string Path = "/test/throw.json";
    public const string SecretMessage = "Sensitive internal detail";

    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        next(app);
        app.Map(Path, branch => branch.Run(_ => throw new InvalidOperationException(SecretMessage)));
    };
}
