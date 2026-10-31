using AspireApp1.Server.Data;
using Microsoft.AspNetCore.Identity;

namespace AspireApp1.Server.Auth;

internal static class IdentitySetup
{
    /// <summary>
    /// ASP.NET Core Identity with cookie sessions for the same-origin React app. Identity's defaults
    /// for passwords, lockout and tokens; only the cookie is tightened.
    /// </summary>
    public static IHostApplicationBuilder AddAppIdentity(this IHostApplicationBuilder builder)
    {
        builder.Services
            .AddIdentityApiEndpoints<IdentityUser>(options =>
            {
                // Not a password or token rule: without it /confirmEmail?changedEmail= could save an
                // address another account already uses.
                options.User.RequireUniqueEmail = true;
            })
            .AddEntityFrameworkStores<AppDbContext>();

        builder.Services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;

            // This is an API: answer with status codes instead of redirecting to a login page.
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        builder.Services.AddAuthorization();

        return builder;
    }
}
