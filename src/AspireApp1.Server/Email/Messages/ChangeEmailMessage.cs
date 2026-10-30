using System.Net;

namespace AspireApp1.Server.Email.Messages;

/// <summary>Sent to the new address when a user asks to change their email (F5).</summary>
internal static class ChangeEmailMessage
{
    public const string Subject = "Confirm your new email address";

    public static EmailMessage Create(string to, string confirmLink)
    {
        var text = $"""
            You asked to use this address for your {Branding.ProductName} account.

            Confirm it by opening this link:

            {confirmLink}

            The link is valid for 24 hours. Your current address keeps working until you confirm. If you didn't ask for this, you can ignore this email.
            """;

        var link = WebUtility.HtmlEncode(confirmLink);
        var html = $"""
            <p>You asked to use this address for your {WebUtility.HtmlEncode(Branding.ProductName)} account.</p>
            <p><a href="{link}">Confirm your new email address</a></p>
            <p>Or copy this link into your browser:<br>{link}</p>
            <p>The link is valid for 24 hours. Your current address keeps working until you confirm. If you didn't ask for this, you can ignore this email.</p>
            """;

        return new EmailMessage(to, Subject, text, html);
    }
}
