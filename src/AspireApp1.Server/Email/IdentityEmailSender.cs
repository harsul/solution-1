using System.Net;
using AspireApp1.Server.Email.Messages;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace AspireApp1.Server.Email;

/// <summary>
/// The email sender used by Identity's built-in endpoints. Builds the messages and hands them to
/// <see cref="IEmailDelivery"/>. Never fails the request that triggered the email.
/// </summary>
internal sealed class IdentityEmailSender(
    IEmailDelivery delivery,
    IOptions<EmailOptions> options,
    ILogger<IdentityEmailSender> logger) : IEmailSender<IdentityUser>
{
    /// <summary>
    /// The built-in link points to the API and is built from the request's host. Only its
    /// <c>userId</c> and <c>code</c> are kept; the link in the email points to the frontend's
    /// confirm page at the configured public URL.
    /// </summary>
    public async Task SendConfirmationLinkAsync(IdentityUser user, string email, string confirmationLink)
    {
        try
        {
            var query = QueryHelpers.ParseQuery(new Uri(WebUtility.HtmlDecode(confirmationLink)).Query);
            string? userId = query["userId"], code = query["code"];
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(code))
            {
                // Identity changed its link format: better no email than a useless one.
                logger.LogWarning("Confirmation email for user {UserId} not sent: the built-in link has no userId/code", user.Id);
                return;
            }

            var link = EmailLinks.ConfirmEmail(options.Value.PublicUrl, userId, code);
            await delivery.SendAsync(ConfirmEmailMessage.Create(email, link), CancellationToken.None);
        }
        catch (Exception ex)
        {
            // Never fail the request (e.g. registration) because of email; the user can resend.
            logger.LogError(ex, "Sending the confirmation email failed for user {UserId}", user.Id);
        }
    }

    // Password reset emails come from POST /api/auth/password/forgot (F2); the built-in /forgotPassword must not send anything.
    public Task SendPasswordResetLinkAsync(IdentityUser user, string email, string resetLink) => NotSent(user);

    public Task SendPasswordResetCodeAsync(IdentityUser user, string email, string resetCode) => NotSent(user);

    private Task NotSent(IdentityUser user)
    {
        logger.LogInformation("Password reset email for user {UserId} not sent: the built-in /forgotPassword is not used (see POST /api/auth/password/forgot)", user.Id);
        return Task.CompletedTask;
    }
}
