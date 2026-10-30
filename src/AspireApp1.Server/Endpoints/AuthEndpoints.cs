using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;

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

        auth.MapIdentityApi<IdentityUser>().AddEndpointFilter(BlockBuiltInAccountChanges);

        auth.MapPost("/logout", async (SignInManager<IdentityUser> signInManager) =>
            {
                await signInManager.SignOutAsync();
                return TypedResults.NoContent();
            })
            .RequireAuthorization();

        return app;
    }

    /// <summary>
    /// Email and password changes go through /api/account (password check, notification, sessions;
    /// F4/F5). The built-in ways are blocked: <c>newEmail</c>/<c>newPassword</c> on /manage/info, and
    /// <c>changedEmail</c> on /confirmEmail, which would otherwise accept our change-email links.
    /// </summary>
    private static async ValueTask<object?> BlockBuiltInAccountChanges(
        EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        if (context.HttpContext.Request.Query.ContainsKey("changedEmail")
            || context.Arguments.Any(a => a is InfoRequest { NewEmail.Length: > 0 }))
        {
            return Blocked("UseAccountEmail", "Change the email address in Account settings.");
        }

        if (context.Arguments.Any(a => a is InfoRequest { NewPassword.Length: > 0 }))
        {
            return Blocked("UseAccountPassword", "Change the password in Account settings.");
        }

        return await next(context);
    }

    private static ValidationProblem Blocked(string code, string description) =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]> { [code] = [description] });
}
