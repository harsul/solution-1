using System.Net;

namespace AspireApp1.Server.Email.Messages;

internal static class ConfirmEmailMessage
{
    public const string Subject = "Confirm your email address";

    public static EmailMessage Create(string to, string confirmLink)
    {
        var text = $"""
            Please confirm your email address for {Branding.ProductName} by opening this link:

            {confirmLink}

            The link is valid for 24 hours. If you didn't create an account, you can ignore this email.
            """;

        var link = WebUtility.HtmlEncode(confirmLink);
        var html = $"""
            <p>Please confirm your email address for {WebUtility.HtmlEncode(Branding.ProductName)}.</p>
            <p><a href="{link}">Confirm email address</a></p>
            <p>Or copy this link into your browser:<br>{link}</p>
            <p>The link is valid for 24 hours. If you didn't create an account, you can ignore this email.</p>
            """;

        return new EmailMessage(to, Subject, text, html);
    }
}
