using System.Net;

namespace AspireApp1.Server.Email.Messages;

internal static class ResetPasswordMessage
{
    public const string Subject = "Reset your password";

    public static EmailMessage Create(string to, string resetLink)
    {
        var text = $"""
            We received a request to reset the password for your {Branding.ProductName} account.

            Choose a new password by opening this link:

            {resetLink}

            The link is valid for 24 hours and works once. If you didn't ask to reset your password, you can ignore this email; your password stays the same.
            """;

        var link = WebUtility.HtmlEncode(resetLink);
        var html = $"""
            <p>We received a request to reset the password for your {WebUtility.HtmlEncode(Branding.ProductName)} account.</p>
            <p><a href="{link}">Choose a new password</a></p>
            <p>Or copy this link into your browser:<br>{link}</p>
            <p>The link is valid for 24 hours and works once. If you didn't ask to reset your password, you can ignore this email; your password stays the same.</p>
            """;

        return new EmailMessage(to, Subject, text, html);
    }
}
