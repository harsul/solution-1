using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireApp1.Server.xIntegration.TestDoubles;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.WebUtilities;
using static AspireApp1.Server.xIntegration.TestDoubles.AuthHelpers;
using static AspireApp1.Server.xIntegration.TestDoubles.EmailHelpers;

namespace AspireApp1.Server.xIntegration;

public class PasswordResetTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static Task<HttpResponseMessage> ForgotAsync(HttpClient client, string email) =>
        client.PostAsJsonAsync("/api/auth/forgotPassword", new { email }, Ct);

    [Fact]
    public async Task Forgot_for_confirmed_account_sends_reset_link_to_frontend()
    {
        var client = factory.CreateHttpsClient();
        var email = await RegisterConfirmedAsync(factory, client);

        var response = await ForgotAsync(client, email);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var message = factory.Emails.SentTo(email).Last();
        Assert.Equal("Reset your password", message.Subject);
        var link = LinkIn(message.TextBody);
        Assert.Equal($"{ServerFactory.PublicUrl}/reset-password", link.GetLeftPart(UriPartial.Path));
        var query = QueryHelpers.ParseQuery(link.Query);
        Assert.Equal(email, query["email"]);
        Assert.False(string.IsNullOrEmpty(query["code"]));
        Assert.Contains("24 hours", message.TextBody);
    }

    [Fact]
    public async Task Forgot_for_unknown_email_returns_200_and_sends_nothing()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();

        var response = await ForgotAsync(client, email);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(factory.Emails.SentTo(email));
    }

    [Fact]
    public async Task Forgot_for_unconfirmed_account_returns_200_and_sends_no_reset_email()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        var response = await ForgotAsync(client, email);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain(factory.Emails.SentTo(email), m => m.Subject == "Reset your password");
    }

    [Fact]
    public async Task Same_response_for_existing_and_unknown_accounts()
    {
        var client = factory.CreateHttpsClient();
        var existing = await RegisterConfirmedAsync(factory, client);

        var known = await ForgotAsync(client, existing);
        var unknown = await ForgotAsync(client, NewEmail());

        Assert.Equal(known.StatusCode, unknown.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(Ct), await unknown.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task Reset_email_goes_to_the_stored_address_not_the_typed_spelling()
    {
        var client = factory.CreateHttpsClient();
        var email = await RegisterConfirmedAsync(factory, client);
        var typed = email.ToUpperInvariant();

        await ForgotAsync(client, typed);

        Assert.Empty(factory.Emails.SentTo(typed));
        var link = LinkIn(factory.Emails.SentTo(email).Last().TextBody);
        Assert.Equal(email, QueryHelpers.ParseQuery(link.Query)["email"]);
    }

    private const string NewPassword = "N3wPassw0rd!";

    /// <summary>Requests a reset for <paramref name="email"/> on <paramref name="client"/> and returns the link's values.</summary>
    private async Task<(string Email, string Code)> ResetLinkAsync(HttpClient client, string email)
    {
        (await ForgotAsync(client, email)).EnsureSuccessStatusCode();
        var query = QueryHelpers.ParseQuery(LinkIn(factory.Emails.SentTo(email).Last().TextBody).Query);
        return (query["email"].ToString(), query["code"].ToString());
    }

    private static Task<HttpResponseMessage> ResetAsync(HttpClient client, (string Email, string Code) link, string newPassword = NewPassword) =>
        client.PostAsJsonAsync("/api/auth/resetPassword", new { email = link.Email, resetCode = link.Code, newPassword }, Ct);

    private static async Task<string[]> ErrorCodesAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").EnumerateObject().Select(e => e.Name).ToArray();
    }

    [Fact]
    public async Task Reset_with_link_values_changes_the_password()
    {
        var client = factory.CreateHttpsClient();
        var email = await RegisterConfirmedAsync(factory, client);

        var response = await ResetAsync(client, await ResetLinkAsync(client, email));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email, NewPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
    }

    [Fact]
    public async Task Reset_link_works_only_once()
    {
        var client = factory.CreateHttpsClient();
        var email = await RegisterConfirmedAsync(factory, client);
        var link = await ResetLinkAsync(client, email);
        (await ResetAsync(client, link)).EnsureSuccessStatusCode();

        var second = await ResetAsync(client, link, "An0therPassw0rd!");

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Contains("InvalidToken", await ErrorCodesAsync(second));
    }

    [Fact]
    public async Task Reset_for_unknown_or_unconfirmed_email_looks_like_a_bad_code()
    {
        var client = factory.CreateHttpsClient();
        var unconfirmed = NewEmail();
        await RegisterAsync(client, unconfirmed);

        foreach (var email in new[] { NewEmail(), unconfirmed })
        {
            var response = await ResetAsync(client, (email, "bm90LWEtdG9rZW4"));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(["InvalidToken"], await ErrorCodesAsync(response));
        }
    }

    [Fact]
    public void All_Identity_tokens_incl_reset_and_confirmation_links_are_valid_for_1_day()
    {
        var options = factory.Services.GetRequiredService<IOptions<DataProtectionTokenProviderOptions>>().Value;

        Assert.Equal(TimeSpan.FromDays(1), options.TokenLifespan);
    }

    [Fact]
    public async Task Expired_reset_link_is_rejected_as_InvalidToken()
    {
        // Identity's token provider has no test clock, so shrink the lifetime and let it pass.
        await using var shortLived = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            s.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromMilliseconds(1))));
        var client = shortLived.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var email = await RegisterConfirmedAsync(factory, factory.CreateHttpsClient());
        var link = await ResetLinkAsync(client, email);
        await Task.Delay(TimeSpan.FromMilliseconds(50), Ct);

        var response = await ResetAsync(client, link);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("InvalidToken", await ErrorCodesAsync(response));
    }

    [Theory]
    [InlineData("Ab1!", "PasswordTooShort")]
    [InlineData("Password!", "PasswordRequiresDigit")]
    public async Task Reset_with_a_weak_password_returns_the_rule_code(string newPassword, string expectedCode)
    {
        var client = factory.CreateHttpsClient();
        var email = await RegisterConfirmedAsync(factory, client);

        var response = await ResetAsync(client, await ResetLinkAsync(client, email), newPassword);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(expectedCode, await ErrorCodesAsync(response));
    }

    [Fact]
    public async Task Reset_does_not_lift_lockout_until_it_expires()
    {
        var client = factory.CreateHttpsClient();
        var email = await RegisterConfirmedAsync(factory, client);
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            await LoginAsync(client, email, "Wrong-passw0rd");
        }

        (await ResetAsync(client, await ResetLinkAsync(client, email))).EnsureSuccessStatusCode();
        var whileLocked = await LoginAsync(factory.CreateHttpsClient(), email, NewPassword);

        Assert.Equal(HttpStatusCode.Unauthorized, whileLocked.StatusCode);
        Assert.Contains("LockedOut", await whileLocked.Content.ReadAsStringAsync(Ct));

        // Let the lock run out (no test clock in Identity), then the new password works.
        using (var scope = factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
            var user = await users.FindByEmailAsync(email);
            await users.SetLockoutEndDateAsync(user!, DateTimeOffset.UtcNow.AddSeconds(-1));
        }
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email, NewPassword)).StatusCode);
    }

    [Fact]
    public async Task Forgot_returns_200_when_email_delivery_fails()
    {
        var client = factory.CreateHttpsClient();
        var email = await RegisterConfirmedAsync(factory, client);
        var failing = new CapturingEmailDelivery { Fail = true };
        await using var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            s.AddSingleton<AspireApp1.Server.Email.IEmailDelivery>(failing)));
        var failingClient = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        var response = await ForgotAsync(failingClient, email);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, failing.Attempts);
    }
}
