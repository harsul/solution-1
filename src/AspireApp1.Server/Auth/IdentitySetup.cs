using AspireApp1.Server.Data;
using Microsoft.AspNetCore.Identity;

namespace AspireApp1.Server.Auth;

internal static class IdentitySetup
{
    /// <summary>
    /// ASP.NET Core Identity with cookie sessions for the same-origin React app.
    /// Password, lockout and cookie rules follow the F1 spec.
    /// </summary>
    public static IHostApplicationBuilder AddAppIdentity(this IHostApplicationBuilder builder)
    {
        builder.Services
            .AddIdentityApiEndpoints<IdentityUser>(options =>
            {
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequiredUniqueChars = 1;

                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
                options.Lockout.AllowedForNewUsers = true;

                options.User.RequireUniqueEmail = true;
                options.SignIn.RequireConfirmedAccount = false;

                // Email confirmation links use their own provider (24 h lifetime).
                options.Tokens.EmailConfirmationTokenProvider = EmailConfirmationTokenProvider.ProviderName;
            })
            .AddEntityFrameworkStores<AppDbContext>()
            .AddPasswordValidator<RequireLetterPasswordValidator>()
            .AddTokenProvider<EmailConfirmationTokenProvider>(EmailConfirmationTokenProvider.ProviderName);

        // Password reset links (default token provider) are valid for 1 hour; email confirmation has
        // its own provider and options (24 h), so this doesn't affect it. Note: the built-in change-email
        // flow also uses the default provider (1 h); the app doesn't offer changing the email yet.
        builder.Services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(1));

        builder.Services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            options.ExpireTimeSpan = TimeSpan.FromDays(14);
            options.SlidingExpiration = true;

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
