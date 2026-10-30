using Microsoft.AspNetCore.Identity;

namespace AspireApp1.Server.Endpoints;

internal static class AuthEndpoints
{
    /// <summary>
    /// Built-in Identity API endpoints (register, login, manage/info, ...) under /api/auth,
    /// plus logout, which the built-in set doesn't include.
    /// </summary>
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/api/auth").WithTags("Auth");

        auth.MapIdentityApi<IdentityUser>();

        auth.MapPost("/logout", async (SignInManager<IdentityUser> signInManager) =>
            {
                await signInManager.SignOutAsync();
                return TypedResults.NoContent();
            })
            .RequireAuthorization();

        return app;
    }
}
