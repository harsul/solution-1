using System.Net;

namespace AspireApp1.Server.Email.Messages;

/// <summary>Sent to the old address after the email was changed (F5). Contains no link.</summary>
internal static class EmailChangedMessage
{
    public const string Subject = "Your email address was changed";

    public static EmailMessage Create(string to, string newEmail)
    {
        var text = $"""
            The email address of your Aspire Starter account was changed to {newEmail}. From now on, you sign in with that address and emails go there.

            If you did this, you don't need to do anything.

            If you didn't, someone else knew your password and could sign in to your account. Contact support right away.
            """;

        var html = $"""
            <p>The email address of your Aspire Starter account was changed to <strong>{WebUtility.HtmlEncode(newEmail)}</strong>. From now on, you sign in with that address and emails go there.</p>
            <p>If you did this, you don't need to do anything.</p>
            <p>If you didn't, someone else knew your password and could sign in to your account. Contact support right away.</p>
            """;

        return new EmailMessage(to, Subject, text, html);
    }
}
