using System.Net;
using System.Net.Http.Json;
using AspireApp1.Server.xIntegration.TestDoubles;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.WebUtilities;
using static AspireApp1.Server.xIntegration.TestDoubles.AuthHelpers;
using static AspireApp1.Server.xIntegration.TestDoubles.EmailHelpers;

namespace AspireApp1.Server.xIntegration;

public class PasswordResetTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static Task<HttpResponseMessage> ForgotAsync(HttpClient client, string email) =>
        client.PostAsJsonAsync("/api/auth/password/forgot", new { email }, Ct);

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
        Assert.Contains("1 hour", message.TextBody);
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
    public async Task Forgot_for_unconfirmed_account_sends_confirmation_link_instead()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        var response = await ForgotAsync(client, email);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var message = factory.Emails.SentTo(email).Last();
        Assert.Equal("Confirm your email address first", message.Subject);
        var link = LinkIn(message.TextBody);
        Assert.Equal($"{ServerFactory.PublicUrl}/confirm-email", link.GetLeftPart(UriPartial.Path));
        Assert.DoesNotContain(factory.Emails.SentTo(email), m => m.Subject == "Reset your password");

        // The link in that email really confirms the address.
        Assert.Equal(HttpStatusCode.OK, (await ConfirmEmailAsync(client, link)).StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public async Task Forgot_with_malformed_email_returns_400(string email)
    {
        var client = factory.CreateHttpsClient();

        var response = await ForgotAsync(client, email);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
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
    public async Task Sixth_forgot_request_within_15_minutes_is_rate_limited()
    {
        // Real limits (5 per 15 minutes), on a host of its own.
        await using var limited = factory.WithWebHostBuilder(b =>
            b.UseSetting("RateLimits:ForgotPassword:PermitLimit", "5"));
        var client = limited.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        for (var i = 1; i <= 5; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await ForgotAsync(client, NewEmail())).StatusCode);
        }
        var sixth = await ForgotAsync(client, NewEmail());

        Assert.Equal(HttpStatusCode.TooManyRequests, sixth.StatusCode);
        Assert.True(sixth.Headers.Contains("Retry-After"));
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

    [Fact]
    public async Task Reset_link_is_accepted_by_the_built_in_reset_once()
    {
        var client = factory.CreateHttpsClient();
        var email = await RegisterConfirmedAsync(factory, client);
        await ForgotAsync(client, email);
        var query = QueryHelpers.ParseQuery(LinkIn(factory.Emails.SentTo(email).Last().TextBody).Query);
        var body = new { email = query["email"].ToString(), resetCode = query["code"].ToString(), newPassword = "N3wPassw0rd!" };

        var first = await client.PostAsJsonAsync("/api/auth/resetPassword", body, Ct);
        var second = await client.PostAsJsonAsync("/api/auth/resetPassword", body, Ct);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
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
