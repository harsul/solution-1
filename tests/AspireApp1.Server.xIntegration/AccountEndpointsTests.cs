using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Net.Http.Headers;
using AspireApp1.Server.xIntegration.TestDoubles;
using static AspireApp1.Server.xIntegration.TestDoubles.AuthHelpers;
using static AspireApp1.Server.xIntegration.TestDoubles.EmailHelpers;

namespace AspireApp1.Server.xIntegration;

public class AccountEndpointsTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    private const string NewPassword = "N3wPassw0rd!";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static Task<HttpResponseMessage> ChangePasswordAsync(HttpClient client, string currentPassword, string newPassword = NewPassword) =>
        client.PostAsJsonAsync("/api/account/password", new { currentPassword, newPassword }, Ct);

    private static Task<HttpResponseMessage> InfoAsync(HttpClient client) => client.GetAsync("/api/auth/manage/info", Ct);

    private static async Task<string[]> ErrorCodesAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").EnumerateObject().Select(e => e.Name).ToArray();
    }

    /// <summary>A second signed-in "device" for the same account.</summary>
    private async Task<HttpClient> OtherDeviceAsync(string email, string password = ValidPassword)
    {
        var client = factory.CreateHttpsClient();
        (await LoginAsync(client, email, password)).EnsureSuccessStatusCode();
        return client;
    }

    [Theory]
    [InlineData("/api/account/password")]
    public async Task Account_endpoints_require_a_session(string route)
    {
        var response = await factory.CreateHttpsClient().PostAsJsonAsync(route, new { }, Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Change_password_with_correct_current_password_works()
    {
        var (client, email) = await SignedInClientAsync(factory);

        var response = await ChangePasswordAsync(client, ValidPassword);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email, NewPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
    }

    [Fact]
    public async Task Change_password_signs_out_other_sessions_but_keeps_this_one()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var other = await OtherDeviceAsync(email);
        Assert.Equal(HttpStatusCode.OK, (await InfoAsync(other)).StatusCode);

        (await ChangePasswordAsync(client, ValidPassword)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Unauthorized, (await InfoAsync(other)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await InfoAsync(client)).StatusCode);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Change_password_keeps_the_remember_me_choice(bool rememberMe)
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        (await RegisterAsync(client, email)).EnsureSuccessStatusCode();
        (await LoginAsync(client, email, rememberMe: rememberMe)).EnsureSuccessStatusCode();

        var response = await ChangePasswordAsync(client, ValidPassword);

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith(".AspNetCore.Identity.Application="));
        Assert.Equal(rememberMe, SetCookieHeaderValue.Parse(cookie).Expires is not null);
    }

    [Fact]
    public async Task Wrong_current_password_returns_PasswordMismatch()
    {
        var (client, email) = await SignedInClientAsync(factory);

        var response = await ChangePasswordAsync(client, "Wrong-passw0rd");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["PasswordMismatch"], await ErrorCodesAsync(response));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
    }

    [Fact]
    public async Task Fifth_wrong_current_password_locks_the_account()
    {
        var (client, email) = await SignedInClientAsync(factory);
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            Assert.Equal(["PasswordMismatch"], await ErrorCodesAsync(await ChangePasswordAsync(client, "Wrong-passw0rd")));
        }

        var fifth = await ChangePasswordAsync(client, "Wrong-passw0rd");
        var correct = await ChangePasswordAsync(client, ValidPassword);

        Assert.Equal(["LockedOut"], await ErrorCodesAsync(fifth));
        Assert.Equal(["LockedOut"], await ErrorCodesAsync(correct));
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
    }

    [Theory]
    [InlineData("Ab1", "PasswordTooShort")]
    [InlineData("abcdefgh", "PasswordRequiresDigit")]
    [InlineData("12345678", "PasswordRequiresLetter")]
    public async Task Weak_new_password_returns_rule_codes(string newPassword, string expectedCode)
    {
        var (client, _) = await SignedInClientAsync(factory);

        var response = await ChangePasswordAsync(client, ValidPassword, newPassword);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(expectedCode, await ErrorCodesAsync(response));
    }

    [Fact]
    public async Task Weak_new_password_with_wrong_current_password_only_says_PasswordMismatch()
    {
        var (client, _) = await SignedInClientAsync(factory);

        var response = await ChangePasswordAsync(client, "Wrong-passw0rd", "Ab1");

        Assert.Equal(["PasswordMismatch"], await ErrorCodesAsync(response));
    }

    [Fact]
    public async Task Password_change_notifies_confirmed_address()
    {
        var client = factory.CreateHttpsClient();
        var email = await RegisterConfirmedAsync(factory, client);
        (await LoginAsync(client, email)).EnsureSuccessStatusCode();

        (await ChangePasswordAsync(client, ValidPassword)).EnsureSuccessStatusCode();

        var message = factory.Emails.SentTo(email).Last();
        Assert.Equal("Your password was changed", message.Subject);
    }

    [Fact]
    public async Task Password_change_does_not_notify_unconfirmed_address()
    {
        var (client, email) = await SignedInClientAsync(factory);

        (await ChangePasswordAsync(client, ValidPassword)).EnsureSuccessStatusCode();

        Assert.DoesNotContain(factory.Emails.SentTo(email), m => m.Subject == "Your password was changed");
    }
}
