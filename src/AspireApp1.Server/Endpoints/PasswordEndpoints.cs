using System.ComponentModel.DataAnnotations;
using System.Text;
using AspireApp1.Server.Email;
using AspireApp1.Server.Email.Messages;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace AspireApp1.Server.Endpoints;

public sealed record ForgotPasswordRequest(string? Email);

internal static class PasswordEndpoints
{
    /// <summary>
    /// <c>POST /api/auth/password/forgot</c>: always the same neutral 200 for a valid email address.
    /// Confirmed account → reset link; unconfirmed → "confirm your email first" link; unknown → nothing.
    /// The reset itself uses Identity's built-in <c>/api/auth/resetPassword</c>.
    /// </summary>
    public static IEndpointRouteBuilder MapPasswordEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGroup("/api/auth/password").WithTags("Auth")
            .MapPost("/forgot", ForgotAsync);

        return app;
    }

    private static async Task<Results<Ok, ValidationProblem>> ForgotAsync(
        ForgotPasswordRequest request,
        UserManager<IdentityUser> userManager,
        IEmailDelivery delivery,
        IOptions<EmailOptions> options,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        var email = request.Email?.Trim();
        if (string.IsNullOrEmpty(email) || !new EmailAddressAttribute().IsValid(email))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["email"] = ["Enter a valid email address."],
            });
        }

        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            return TypedResults.Ok();
        }

        // Send to the address stored on the account, never to the typed one: the lookup compares
        // normalized (upper-cased) addresses, so a look-alike spelling can match someone else's account.
        var to = await userManager.GetEmailAsync(user) ?? email;

        try
        {
            var message = await userManager.IsEmailConfirmedAsync(user)
                ? ResetPasswordMessage.Create(to, EmailLinks.ResetPassword(
                    options.Value.PublicUrl, to, Encode(await userManager.GeneratePasswordResetTokenAsync(user))))
                : ConfirmBeforeResetMessage.Create(to, EmailLinks.ConfirmEmail(
                    options.Value.PublicUrl, await userManager.GetUserIdAsync(user),
                    Encode(await userManager.GenerateEmailConfirmationTokenAsync(user))));

            await delivery.SendAsync(message, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The response must not reveal anything; the user can request again.
            loggers.CreateLogger(typeof(PasswordEndpoints)).LogError(ex, "Sending the forgot-password email failed for user {UserId}", user.Id);
        }

        return TypedResults.Ok();
    }

    /// <summary>Same encoding as Identity's built-in endpoints, so their /resetPassword and /confirmEmail decode it.</summary>
    private static string Encode(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
}
