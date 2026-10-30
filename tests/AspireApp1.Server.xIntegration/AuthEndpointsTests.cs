using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireApp1.Server.xIntegration.TestDoubles;
using static AspireApp1.Server.xIntegration.TestDoubles.AuthHelpers;

namespace AspireApp1.Server.xIntegration;

public class AuthEndpointsTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    private sealed record InfoDto(string Email, bool IsEmailConfirmed);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Register_with_valid_data_returns_200()
    {
        var client = factory.CreateHttpsClient();

        var response = await RegisterAsync(client, NewEmail());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Login_with_cookies_then_info_returns_email()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        var login = await LoginAsync(client, email);
        var info = await client.GetFromJsonAsync<InfoDto>("/api/auth/manage/info", Ct);

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(email, info?.Email);
    }

    [Fact]
    public async Task Auth_cookie_is_HttpOnly_Secure_and_SameSite_Strict()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        var login = await LoginAsync(client, email);

        var cookie = Assert.Single(login.Headers.GetValues("Set-Cookie"), c => c.StartsWith(".AspNetCore.Identity.Application="));
        var attributes = cookie.Split(';', StringSplitOptions.TrimEntries).Select(a => a.ToLowerInvariant()).ToArray();
        Assert.Contains("httponly", attributes);
        Assert.Contains("secure", attributes);
        Assert.Contains("samesite=strict", attributes);
    }

    [Fact]
    public async Task Login_with_wrong_password_returns_401_Failed()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        var response = await LoginAsync(client, email, "Wrong-passw0rd");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Failed", await ReadProblemDetailAsync(response));
    }

    [Fact]
    public async Task Login_with_unknown_email_returns_same_401_Failed()
    {
        var client = factory.CreateHttpsClient();

        var response = await LoginAsync(client, NewEmail());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Failed", await ReadProblemDetailAsync(response));
    }

    [Fact]
    public async Task Info_without_session_returns_401_not_a_redirect()
    {
        var client = factory.CreateHttpsClient();

        var response = await client.GetAsync("/api/auth/manage/info", Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Logout_ends_the_session()
    {
        var (client, _) = await SignedInClientAsync(factory);

        var logout = await client.PostAsync("/api/auth/logout", content: null, Ct);
        var info = await client.GetAsync("/api/auth/manage/info", Ct);

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, info.StatusCode);
    }

    private static async Task<string?> ReadProblemDetailAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("detail").GetString();
    }
}
