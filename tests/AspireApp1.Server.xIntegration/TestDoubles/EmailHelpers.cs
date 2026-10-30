using Microsoft.AspNetCore.WebUtilities;

namespace AspireApp1.Server.xIntegration.TestDoubles;

internal static class EmailHelpers
{
    /// <summary>The first https link in an email's text.</summary>
    public static Uri LinkIn(string text) =>
        new(text.Split(['\n', ' '], StringSplitOptions.TrimEntries).First(w => w.StartsWith("https://")));

    /// <summary>Calls the built-in confirm endpoint with the values from a frontend confirmation link.</summary>
    public static Task<HttpResponseMessage> ConfirmEmailAsync(HttpClient client, Uri confirmLink)
    {
        var query = QueryHelpers.ParseQuery(confirmLink.Query);
        return client.GetAsync(
            QueryHelpers.AddQueryString("/api/auth/confirmEmail",
                new Dictionary<string, string?> { ["userId"] = query["userId"], ["code"] = query["code"] }),
            TestContext.Current.CancellationToken);
    }

    /// <summary>Registers a user and confirms the email with the link from the sign-up email.</summary>
    public static async Task<string> RegisterConfirmedAsync(ServerFactory factory, HttpClient client)
    {
        var email = AuthHelpers.NewEmail();
        (await AuthHelpers.RegisterAsync(client, email)).EnsureSuccessStatusCode();
        (await ConfirmEmailAsync(client, LinkIn(factory.Emails.SentTo(email).Single().TextBody))).EnsureSuccessStatusCode();
        return email;
    }
}
