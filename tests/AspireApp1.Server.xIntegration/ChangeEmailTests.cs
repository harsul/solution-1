using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireApp1.Server.xIntegration.TestDoubles;
using Microsoft.AspNetCore.Hosting;
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
}
