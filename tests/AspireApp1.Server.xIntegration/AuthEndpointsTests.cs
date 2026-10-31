using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireApp1.Server.xIntegration.TestDoubles;
using Microsoft.Net.Http.Headers;
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
    public async Task Logout_without_a_session_returns_401_not_a_redirect()
    {
        var response = await factory.CreateHttpsClient().PostAsync("/api/auth/logout", content: null, Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/auth/password/forgot")]
    [InlineData("/api/account/password")]
    [InlineData("/api/account/email")]
    [InlineData("/api/account/sessions")]
    public async Task Removed_custom_endpoints_return_404(string path)
    {
        var (client, _) = await SignedInClientAsync(factory);

        var response = await client.PostAsync(path, content: null, Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
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

    [Fact]
    public async Task Register_with_an_existing_email_returns_DuplicateUserName()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        var response = await RegisterAsync(client, email);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("DuplicateUserName", await ReadErrorCodesAsync(response));
    }

    [Theory]
    [InlineData("Ab1!", "PasswordTooShort")]
    [InlineData("passw0rd!", "PasswordRequiresUpper")]
    [InlineData("PASSW0RD!", "PasswordRequiresLower")]
    [InlineData("Password!", "PasswordRequiresDigit")]
    [InlineData("Passw0rd", "PasswordRequiresNonAlphanumeric")]
    public async Task Register_rejects_passwords_that_break_a_rule(string password, string expectedCode)
    {
        var client = factory.CreateHttpsClient();

        var response = await RegisterAsync(client, NewEmail(), password);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(expectedCode, await ReadErrorCodesAsync(response));
    }

    [Fact]
    public async Task Sixth_attempt_is_LockedOut_even_with_the_correct_password()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        for (var attempt = 1; attempt <= 5; attempt++)
        {
            var wrong = await LoginAsync(client, email, "Wrong-passw0rd");
            Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        }
        var correct = await LoginAsync(client, email);

        Assert.Equal(HttpStatusCode.Unauthorized, correct.StatusCode);
        Assert.Equal("LockedOut", await ReadProblemDetailAsync(correct));
    }

    [Fact]
    public async Task Fewer_than_five_failures_do_not_lock_the_account()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        for (var attempt = 1; attempt <= 4; attempt++)
        {
            await LoginAsync(client, email, "Wrong-passw0rd");
        }
        var correct = await LoginAsync(client, email);

        Assert.Equal(HttpStatusCode.OK, correct.StatusCode);
    }

    [Fact]
    public async Task Remember_me_sets_a_persistent_cookie_for_14_days()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        var login = await LoginAsync(client, email, rememberMe: true);

        var expires = ReadCookieExpiry(AuthCookie(login));
        Assert.NotNull(expires);
        Assert.InRange(expires.Value, DateTimeOffset.UtcNow.AddDays(14).AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(14).AddMinutes(5));
    }

    [Fact]
    public async Task Without_remember_me_the_cookie_ends_with_the_browser_session()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        var login = await LoginAsync(client, email, rememberMe: false);

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Null(ReadCookieExpiry(AuthCookie(login)));
    }

    private static string AuthCookie(HttpResponseMessage response) =>
        Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith(".AspNetCore.Identity.Application="));

    // SetCookieHeaderValue parses the RFC 1123 date independently of the machine's culture.
    private static DateTimeOffset? ReadCookieExpiry(string setCookie) =>
        SetCookieHeaderValue.Parse(setCookie).Expires;

    private static async Task<string[]> ReadErrorCodesAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").EnumerateObject().Select(p => p.Name).ToArray();
    }

    private static async Task<string?> ReadProblemDetailAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("detail").GetString();
    }
}
