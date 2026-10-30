using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;

namespace AspireApp1.Server.RateLimiting;

/// <summary>A fixed-window limit: <see cref="PermitLimit"/> requests per <see cref="Window"/>.</summary>
public sealed class FixedWindowLimit
{
    public int PermitLimit { get; set; }

    public TimeSpan Window { get; set; }
}

/// <summary>Limits from the <c>RateLimits</c> configuration section (tests raise them).</summary>
public sealed class RateLimitOptions
{
    public FixedWindowLimit ResendConfirmation { get; set; } = new() { PermitLimit = 1, Window = TimeSpan.FromMinutes(1) };

    public FixedWindowLimit ForgotPassword { get; set; } = new() { PermitLimit = 5, Window = TimeSpan.FromMinutes(15) };
}

internal static class RateLimitSetup
{
    /// <summary>
    /// Email-sending endpoints (by route pattern) and their limit; everything else is not limited.
    /// Matching the routed endpoint, not the raw path, means every spelling routing accepts
    /// (trailing slash, letter case) shares one limit.
    /// </summary>
    private static readonly Dictionary<string, Func<RateLimitOptions, FixedWindowLimit>> LimitedPaths =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["/api/auth/resendConfirmationEmail"] = o => o.ResendConfirmation,
            ["/api/auth/password/forgot"] = o => o.ForgotPassword,
        };

    /// <summary>
    /// A global limiter partitioned by endpoint and client IP, so only abuse-prone POST endpoints are
    /// limited. Runs after routing (WebApplication routes first), so the endpoint is known.
    /// Rejected requests get 429 ProblemDetails with <c>Retry-After</c>.
    /// </summary>
    public static IHostApplicationBuilder AddAppRateLimiting(this IHostApplicationBuilder builder)
    {
        builder.Services.Configure<RateLimitOptions>(builder.Configuration.GetSection("RateLimits"));

        builder.Services.AddRateLimiter(options =>
        {
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText;
                if (!HttpMethods.IsPost(context.Request.Method) || route is null || !LimitedPaths.TryGetValue(route, out var limitFor))
                {
                    return RateLimitPartition.GetNoLimiter("unlimited");
                }

                var limit = limitFor(context.RequestServices.GetRequiredService<IOptions<RateLimitOptions>>().Value);
                var client = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                return RateLimitPartition.GetFixedWindowLimiter($"{route.ToLowerInvariant()}|{client}", _ =>
                    new FixedWindowRateLimiterOptions { PermitLimit = limit.PermitLimit, Window = limit.Window, QueueLimit = 0 });
            });

            options.OnRejected = async (rejected, cancellationToken) =>
            {
                var response = rejected.HttpContext.Response;
                response.StatusCode = StatusCodes.Status429TooManyRequests;
                if (rejected.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
                }

                await rejected.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new()
                {
                    HttpContext = rejected.HttpContext,
                    ProblemDetails = new ProblemDetails
                    {
                        Status = StatusCodes.Status429TooManyRequests,
                        Title = "Too many requests",
                        Detail = "Please wait a moment before trying again.",
                    },
                });
            };
        });

        return builder;
    }
}
