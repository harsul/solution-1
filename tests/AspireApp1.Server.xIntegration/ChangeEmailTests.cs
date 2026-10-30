using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireApp1.Server.xIntegration.TestDoubles;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using AspireApp1.Server.Auth;
using Microsoft.AspNetCore.WebUtilities;
using static AspireApp1.Server.xIntegration.TestDoubles.AuthHelpers;
using static AspireApp1.Server.xIntegration.TestDoubles.EmailHelpers;

namespace AspireApp1.Server.xIntegration;

public class ChangeEmailTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static Task<HttpResponseMessage> RequestAsync(HttpClient client, string newEmail, string password = ValidPassword) =>
        client.PostAsJsonAsync("/api/account/email", new { newEmail, password }, Ct);

    private static async Task<string[]> ErrorCodesAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").EnumerateObject().Select(e => e.Name).ToArray();
    }

    [Fact]
    public async Task Request_needs_a_session()
    {
        var response = await RequestAsync(factory.CreateHttpsClient(), NewEmail());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Request_sends_link_to_new_address_and_changes_nothing_yet()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var newEmail = NewEmail();

        var response = await RequestAsync(client, newEmail);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var message = Assert.Single(factory.Emails.SentTo(newEmail));
        Assert.Equal("Confirm your new email address", message.Subject);
        var link = LinkIn(message.TextBody);
        Assert.Equal($"{ServerFactory.PublicUrl}/confirm-email-change", link.GetLeftPart(UriPartial.Path));
        var query = QueryHelpers.ParseQuery(link.Query);
        Assert.Equal(newEmail, query["email"]);
        Assert.False(string.IsNullOrEmpty(query["userId"]));
        Assert.False(string.IsNullOrEmpty(query["code"]));
        Assert.Contains("24 hours", message.TextBody);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory.CreateHttpsClient(), newEmail)).StatusCode);
    }

    [Theory]
    [InlineData("not-an-email", "InvalidEmail")]
    [InlineData("", "InvalidEmail")]
    [InlineData("same", "SameEmail")]
    [InlineData("taken", "DuplicateEmail")]
    [InlineData("o'brien@example.com", "InvalidEmail")]
    [InlineData("jürgen@example.com", "InvalidEmail")]
    public async Task Request_rejects_invalid_same_and_used_addresses(string kind, string expectedCode)
    {
        var (client, email) = await SignedInClientAsync(factory);
        var newEmail = kind switch
        {
            "same" => email.ToUpperInvariant(),
            "taken" => (await SignedInClientAsync(factory)).Email,
            _ => kind,
        };

        var response = await RequestAsync(client, newEmail);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([expectedCode], await ErrorCodesAsync(response));
        Assert.DoesNotContain(factory.Emails.Sent, m => m.Subject == "Confirm your new email address" && m.To == newEmail);
    }

    [Fact]
    public async Task Request_with_wrong_password_returns_PasswordMismatch()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var newEmail = NewEmail();

        var same = await RequestAsync(client, email, "Wrong-passw0rd");
        var other = await RequestAsync(client, newEmail, "Wrong-passw0rd");

        Assert.Equal(HttpStatusCode.BadRequest, other.StatusCode);
        Assert.Equal(["PasswordMismatch"], await ErrorCodesAsync(same)); // checked before anything else
        Assert.Equal(["PasswordMismatch"], await ErrorCodesAsync(other));
        Assert.Empty(factory.Emails.SentTo(newEmail));
    }

    [Fact]
    public async Task Request_counts_wrong_passwords_towards_lockout()
    {
        var (client, _) = await SignedInClientAsync(factory);
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            await RequestAsync(client, NewEmail(), "Wrong-passw0rd");
        }

        var fifth = await RequestAsync(client, NewEmail(), "Wrong-passw0rd");
        var correct = await RequestAsync(client, NewEmail());

        Assert.Equal(["LockedOut"], await ErrorCodesAsync(fifth));
        Assert.Equal(["LockedOut"], await ErrorCodesAsync(correct));
    }

    [Fact]
    public async Task Sixth_request_within_15_minutes_is_rate_limited()
    {
        await using var limited = factory.WithWebHostBuilder(b => b.UseSetting("RateLimits:ChangeEmail:PermitLimit", "5"));
        var client = limited.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var email = NewEmail();
        (await RegisterAsync(client, email)).EnsureSuccessStatusCode();
        (await LoginAsync(client, email)).EnsureSuccessStatusCode();

        for (var i = 1; i <= 5; i++)
        {
            Assert.Equal(HttpStatusCode.NoContent, (await RequestAsync(client, NewEmail())).StatusCode);
        }
        var sixth = await RequestAsync(client, NewEmail());

        Assert.Equal(HttpStatusCode.TooManyRequests, sixth.StatusCode);
    }

    [Fact]
    public async Task Built_in_newEmail_is_rejected()
    {
        var (client, _) = await SignedInClientAsync(factory);
        var newEmail = NewEmail();

        var response = await client.PostAsJsonAsync("/api/auth/manage/info", new { newEmail }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["UseAccountEmail"], await ErrorCodesAsync(response));
        Assert.Empty(factory.Emails.SentTo(newEmail));
    }

    [Fact]
    public async Task Built_in_confirmEmail_with_changedEmail_is_rejected()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var newEmail = NewEmail();
        (await RequestAsync(client, newEmail)).EnsureSuccessStatusCode();
        var query = QueryHelpers.ParseQuery(LinkIn(factory.Emails.SentTo(newEmail).Single().TextBody).Query);

        var response = await client.GetAsync(
            $"/api/auth/confirmEmail?userId={query["userId"]}&code={query["code"]}&changedEmail={Uri.EscapeDataString(newEmail)}", Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory.CreateHttpsClient(), newEmail)).StatusCode);
    }

    [Fact]
    public async Task Built_in_password_change_is_rejected()
    {
        var (client, email) = await SignedInClientAsync(factory);

        var response = await client.PostAsJsonAsync(
            "/api/auth/manage/info", new { oldPassword = ValidPassword, newPassword = "N3wPassw0rd!" }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["UseAccountPassword"], await ErrorCodesAsync(response));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
    }

    [Fact]
    public async Task Built_in_manage_info_still_works_without_newEmail()
    {
        var (client, email) = await SignedInClientAsync(factory);

        var response = await client.PostAsJsonAsync("/api/auth/manage/info", new { }, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(email, await response.Content.ReadAsStringAsync(Ct));
    }

    private record LinkValues(string UserId, string Email, string Code);

    private async Task<LinkValues> RequestLinkAsync(HttpClient client, string newEmail)
    {
        (await RequestAsync(client, newEmail)).EnsureSuccessStatusCode();
        var query = QueryHelpers.ParseQuery(LinkIn(factory.Emails.SentTo(newEmail).Last().TextBody).Query);
        return new(query["userId"].ToString(), query["email"].ToString(), query["code"].ToString());
    }

    private static Task<HttpResponseMessage> ConfirmAsync(HttpClient client, LinkValues link) =>
        client.PostAsJsonAsync("/api/account/email/confirm", new { userId = link.UserId, email = link.Email, code = link.Code }, Ct);

    private static Task<HttpResponseMessage> InfoAsync(HttpClient client) => client.GetAsync("/api/auth/manage/info", Ct);

    [Fact]
    public async Task Confirm_changes_email_and_sign_in_name()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var newEmail = NewEmail();
        var link = await RequestLinkAsync(client, newEmail);

        var response = await ConfirmAsync(factory.CreateHttpsClient(), link);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var signIn = factory.CreateHttpsClient();
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(signIn, newEmail)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
        var info = await (await InfoAsync(signIn)).Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(newEmail, info.GetProperty("email").GetString());
        Assert.True(info.GetProperty("isEmailConfirmed").GetBoolean());
    }

    [Fact]
    public async Task Confirm_keeps_this_browser_and_signs_out_others()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var other = factory.CreateHttpsClient();
        (await LoginAsync(other, email)).EnsureSuccessStatusCode();
        var link = await RequestLinkAsync(client, NewEmail());

        (await ConfirmAsync(client, link)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.OK, (await InfoAsync(client)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await InfoAsync(other)).StatusCode);
    }

    [Fact]
    public async Task Confirm_link_works_once()
    {
        var (client, _) = await SignedInClientAsync(factory);
        var link = await RequestLinkAsync(client, NewEmail());
        (await ConfirmAsync(client, link)).EnsureSuccessStatusCode();

        var second = await ConfirmAsync(client, link);

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Equal(["InvalidToken"], await ErrorCodesAsync(second));
    }

    [Fact]
    public async Task Expired_confirm_link_is_InvalidToken()
    {
        // Identity's token provider has no test clock, so shrink the lifetime and let it pass.
        await using var shortLived = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            s.Configure<EmailConfirmationTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromMilliseconds(1))));
        var client = shortLived.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var email = NewEmail();
        (await RegisterAsync(client, email)).EnsureSuccessStatusCode();
        (await LoginAsync(client, email)).EnsureSuccessStatusCode();
        var link = await RequestLinkAsync(client, NewEmail());
        await Task.Delay(TimeSpan.FromMilliseconds(50), Ct);

        var response = await ConfirmAsync(client, link);

        Assert.Equal(["InvalidToken"], await ErrorCodesAsync(response));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
    }

    [Theory]
    [InlineData("not base64 !!")]
    [InlineData("")]
    [InlineData("dGFtcGVyZWQ")]
    public async Task Malformed_or_tampered_code_is_InvalidToken(string code)
    {
        var (client, _) = await SignedInClientAsync(factory);
        var link = await RequestLinkAsync(client, NewEmail());

        var response = await ConfirmAsync(client, link with { Code = code });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["InvalidToken"], await ErrorCodesAsync(response));
    }

    [Fact]
    public async Task Link_for_one_address_cannot_set_another()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var link = await RequestLinkAsync(client, NewEmail());

        var response = await ConfirmAsync(client, link with { Email = NewEmail() });

        Assert.Equal(["InvalidToken"], await ErrorCodesAsync(response));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
    }

    [Fact]
    public async Task Confirm_notifies_old_confirmed_address()
    {
        var client = factory.CreateHttpsClient();
        var email = await RegisterConfirmedAsync(factory, client);
        (await LoginAsync(client, email)).EnsureSuccessStatusCode();
        var newEmail = NewEmail();

        (await ConfirmAsync(client, await RequestLinkAsync(client, newEmail))).EnsureSuccessStatusCode();

        var message = factory.Emails.SentTo(email).Last();
        Assert.Equal("Your email address was changed", message.Subject);
        Assert.Contains(newEmail, message.TextBody);
    }

    [Fact]
    public async Task Confirm_does_not_notify_old_unconfirmed_address()
    {
        var (client, email) = await SignedInClientAsync(factory);

        (await ConfirmAsync(client, await RequestLinkAsync(client, NewEmail()))).EnsureSuccessStatusCode();

        Assert.DoesNotContain(factory.Emails.SentTo(email), m => m.Subject == "Your email address was changed");
    }

    [Fact]
    public async Task Confirm_when_address_was_taken_meanwhile_returns_DuplicateEmail()
    {
        var (client, email) = await SignedInClientAsync(factory);
        var newEmail = NewEmail();
        var link = await RequestLinkAsync(client, newEmail);
        (await RegisterAsync(factory.CreateHttpsClient(), newEmail)).EnsureSuccessStatusCode();

        var response = await ConfirmAsync(client, link);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("DuplicateEmail", await ErrorCodesAsync(response));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory.CreateHttpsClient(), email)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await InfoAsync(client)).StatusCode); // nothing saved, session intact
    }

    [Fact]
    public async Task Confirm_with_a_bad_code_reveals_nothing_about_other_accounts()
    {
        var (client, _) = await SignedInClientAsync(factory);
        var link = await RequestLinkAsync(client, NewEmail());
        var (_, registered) = await SignedInClientAsync(factory);

        var response = await ConfirmAsync(factory.CreateHttpsClient(), link with { Email = registered, Code = "AAAA" });

        Assert.Equal(["InvalidToken"], await ErrorCodesAsync(response));
    }

    [Fact]
    public async Task Confirm_in_a_browser_of_another_user_keeps_that_user_signed_in()
    {
        var (owner, ownerEmail) = await SignedInClientAsync(factory);
        var ownerOther = factory.CreateHttpsClient();
        (await LoginAsync(ownerOther, ownerEmail)).EnsureSuccessStatusCode();
        var link = await RequestLinkAsync(owner, NewEmail());
        var (otherUser, otherEmail) = await SignedInClientAsync(factory);

        (await ConfirmAsync(otherUser, link)).EnsureSuccessStatusCode();

        var info = await (await InfoAsync(otherUser)).Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(otherEmail, info.GetProperty("email").GetString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await InfoAsync(ownerOther)).StatusCode);
    }
}
