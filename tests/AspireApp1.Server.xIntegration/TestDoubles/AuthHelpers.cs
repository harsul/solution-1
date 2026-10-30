using System.Net.Http.Json;

namespace AspireApp1.Server.xIntegration.TestDoubles;

internal static class AuthHelpers
{
    public const string ValidPassword = "Passw0rd!";

    /// <summary>A unique email per test, so tests don't affect each other in the shared database.</summary>
    public static string NewEmail() => $"{Guid.NewGuid():N}@test.local";

    public static Task<HttpResponseMessage> RegisterAsync(HttpClient client, string email, string password = ValidPassword) =>
        client.PostAsJsonAsync("/api/auth/register", new { email, password }, TestContext.Current.CancellationToken);

    public static Task<HttpResponseMessage> LoginAsync(
        HttpClient client, string email, string password = ValidPassword, bool rememberMe = true)
    {
        var mode = rememberMe ? "useCookies=true" : "useSessionCookies=true";
        return client.PostAsJsonAsync($"/api/auth/login?{mode}", new { email, password }, TestContext.Current.CancellationToken);
    }

    /// <summary>Registers a new user and returns an HTTPS client that carries its session cookie.</summary>
    public static async Task<(HttpClient Client, string Email)> SignedInClientAsync(ServerFactory factory)
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        (await RegisterAsync(client, email)).EnsureSuccessStatusCode();
        (await LoginAsync(client, email)).EnsureSuccessStatusCode();
        return (client, email);
    }
}
