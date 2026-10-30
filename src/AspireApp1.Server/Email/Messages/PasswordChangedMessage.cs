using System.Globalization;
using System.Net;

namespace AspireApp1.Server.Email.Messages;

/// <summary>Sent after a password change (F4). Contains no link that changes anything.</summary>
internal static class PasswordChangedMessage
{
    public const string Subject = "Your password was changed";

    public static EmailMessage Create(string to, DateTimeOffset changedAt)
    {
        var when = changedAt.UtcDateTime.ToString("yyyy-MM-dd HH:mm 'UTC'", CultureInfo.InvariantCulture);
        var text = $"""
            The password for your {Branding.ProductName} account was changed on {when}.

            If you did this, you don't need to do anything.

            If this wasn't you, reset your password right away with "Forgot password?" on the sign-in page.
            """;

        var html = $"""
            <p>The password for your {WebUtility.HtmlEncode(Branding.ProductName)} account was changed on {WebUtility.HtmlEncode(when)}.</p>
            <p>If you did this, you don't need to do anything.</p>
            <p>If this wasn't you, reset your password right away with <strong>Forgot password?</strong> on the sign-in page.</p>
            """;

        return new EmailMessage(to, Subject, text, html);
    }
}
