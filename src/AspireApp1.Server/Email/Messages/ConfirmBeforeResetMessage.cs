using System.Net;

namespace AspireApp1.Server.Email.Messages;

/// <summary>Sent instead of a reset link when the account's email isn't confirmed yet (F2 + F3).</summary>
internal static class ConfirmBeforeResetMessage
{
    public const string Subject = "Confirm your email address first";

    public static EmailMessage Create(string to, string confirmLink)
    {
        var text = $"""
            We received a request to reset the password for your {Branding.ProductName} account, but your email address isn't confirmed yet.

            Please confirm it first by opening this link:

            {confirmLink}

            Then request the password reset again on the "Forgot password" page. The link is valid for 24 hours. If you didn't ask for this, you can ignore this email.
            """;

        var link = WebUtility.HtmlEncode(confirmLink);
        var html = $"""
            <p>We received a request to reset the password for your {WebUtility.HtmlEncode(Branding.ProductName)} account, but your email address isn't confirmed yet.</p>
            <p><a href="{link}">Confirm email address</a></p>
            <p>Or copy this link into your browser:<br>{link}</p>
            <p>Then request the password reset again on the "Forgot password" page. The link is valid for 24 hours. If you didn't ask for this, you can ignore this email.</p>
            """;

        return new EmailMessage(to, Subject, text, html);
    }
}
