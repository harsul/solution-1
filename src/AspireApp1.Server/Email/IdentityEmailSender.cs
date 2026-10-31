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
    /// <c>userId</c>, <c>code</c> and (change-email) <c>changedEmail</c> are kept; the link in the
    /// email points to the frontend's confirm page at the configured public URL. The email goes to
    /// the new address for a change and otherwise to the stored one (never the typed spelling; the built-in
    /// endpoints pass the stored one today, this keeps it so).
    /// </summary>
    public async Task SendConfirmationLinkAsync(IdentityUser user, string email, string confirmationLink)
    {
        try
        {
            var query = QueryHelpers.ParseQuery(new Uri(WebUtility.HtmlDecode(confirmationLink)).Query);
            string? userId = query["userId"], code = query["code"], changedEmail = query.GetValueOrDefault("changedEmail");
            var to = string.IsNullOrEmpty(changedEmail) ? user.Email : changedEmail;
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(code) || string.IsNullOrEmpty(to))
            {
                // Identity changed its link format: better no email than a useless one.
                logger.LogWarning("Confirmation email for user {UserId} not sent: the built-in link has no userId/code or there is no address", user.Id);
                return;
            }

            var link = EmailLinks.ConfirmEmail(options.Value.PublicUrl, userId, code, changedEmail);
            await delivery.SendAsync(ConfirmEmailMessage.Create(to, link), CancellationToken.None);
        }
        catch (Exception ex)
        {
            // Never fail the request (e.g. registration) because of email; the user can resend.
            logger.LogError(ex, "Sending the confirmation email failed for user {UserId}", user.Id);
        }
    }

    /// <summary>
    /// The built-in /forgotPassword passes the Base64Url code HTML-encoded. The email goes to the stored
    /// address (never the typed spelling) and links to the frontend's reset page.
    /// </summary>
    public async Task SendPasswordResetCodeAsync(IdentityUser user, string email, string resetCode)
    {
        try
        {
            if (string.IsNullOrEmpty(user.Email))
            {
                logger.LogWarning("Password reset email for user {UserId} not sent: no address", user.Id);
                return;
            }

            var link = EmailLinks.ResetPassword(options.Value.PublicUrl, user.Email, WebUtility.HtmlDecode(resetCode));
            await delivery.SendAsync(ResetPasswordMessage.Create(user.Email, link), CancellationToken.None);
        }
        catch (Exception ex)
        {
            // Never fail the request: the answer must not reveal whether the account exists.
            logger.LogError(ex, "Sending the password reset email failed for user {UserId}", user.Id);
        }
    }

    // The built-in endpoints only call SendPasswordResetCodeAsync.
    public Task SendPasswordResetLinkAsync(IdentityUser user, string email, string resetLink)
    {
        logger.LogInformation("Password reset link for user {UserId} not sent: the built-in endpoints use the reset code", user.Id);
        return Task.CompletedTask;
    }
}
