namespace AspireApp1.Server.Email.Messages;

/// <summary>Sent after an account was deleted (F4). Contains no link.</summary>
internal static class AccountDeletedMessage
{
    public const string Subject = "Your account was deleted";

    public static EmailMessage Create(string to)
    {
        const string text = """
            Your Aspire Starter account and its data were deleted. This can't be undone.

            You're welcome to create a new account with this email address at any time.

            If you didn't delete your account, someone else knew your password. Use a different password wherever you used this one.
            """;

        const string html = """
            <p>Your Aspire Starter account and its data were deleted. This can't be undone.</p>
            <p>You're welcome to create a new account with this email address at any time.</p>
            <p>If you didn't delete your account, someone else knew your password. Use a different password wherever you used this one.</p>
            """;

        return new EmailMessage(to, Subject, text, html);
    }
}
