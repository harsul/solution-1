using System.Net;
using System.Net.Http.Json;
using AspireApp1.Server.Auth;
using AspireApp1.Server.xIntegration.TestDoubles;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using static AspireApp1.Server.xIntegration.TestDoubles.AuthHelpers;

namespace AspireApp1.Server.xIntegration;

public class EmailConfirmationTests(ServerFactory factory) : IClassFixture<ServerFactory>
{
    private sealed record InfoDto(string Email, bool IsEmailConfirmed);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Register_sends_one_confirmation_email_with_a_frontend_link()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();

        (await RegisterAsync(client, email)).EnsureSuccessStatusCode();

        var message = Assert.Single(factory.Emails.SentTo(email));
        Assert.Equal("Confirm your email address", message.Subject);
        var link = ConfirmLinkFrom(message.TextBody);
        Assert.Equal($"{ServerFactory.PublicUrl}/confirm-email", link.GetLeftPart(UriPartial.Path));
        Assert.Contains(WebUtility.HtmlEncode(link.ToString()), message.HtmlBody);
    }

    [Fact]
    public async Task Confirmation_link_uses_public_url_not_request_host()
    {
        var client = factory.CreateClient(new() { BaseAddress = new Uri("https://evil.example") });
        var email = NewEmail();

        await RegisterAsync(client, email);

        var link = ConfirmLinkFrom(Assert.Single(factory.Emails.SentTo(email)).TextBody);
        Assert.StartsWith(ServerFactory.PublicUrl + "/", link.ToString());
        Assert.DoesNotContain("evil.example", link.ToString());
    }

    [Fact]
    public async Task ConfirmEmail_with_link_values_confirms_and_info_reports_it()
    {
        var (client, email) = await SignedInClientAsync(factory);
        Assert.False((await InfoAsync(client)).IsEmailConfirmed);

        var response = await ConfirmAsync(client, ConfirmLinkFrom(LastEmailTo(email)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True((await InfoAsync(client)).IsEmailConfirmed);
    }

    [Fact]
    public async Task ConfirmEmail_again_still_succeeds()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);
        var link = ConfirmLinkFrom(LastEmailTo(email));

        await ConfirmAsync(client, link);
        var again = await ConfirmAsync(client, link);

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
    }

    [Fact]
    public async Task ConfirmEmail_with_tampered_code_returns_401()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);
        var query = QueryHelpers.ParseQuery(ConfirmLinkFrom(LastEmailTo(email)).Query);
        // Change one character in the middle (same length, still valid base64url), so the token's
        // own validation rejects it, not a decoding error.
        var code = query["code"].ToString().ToCharArray();
        var middle = code.Length / 2;
        code[middle] = code[middle] == 'A' ? 'B' : 'A';

        var response = await client.GetAsync(
            QueryHelpers.AddQueryString("/api/auth/confirmEmail",
                new Dictionary<string, string?> { ["userId"] = query["userId"], ["code"] = new string(code) }), Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public void Confirmation_tokens_are_valid_for_24_hours()
    {
        var options = factory.Services.GetRequiredService<IOptions<EmailConfirmationTokenProviderOptions>>().Value;

        Assert.Equal(TimeSpan.FromHours(24), options.TokenLifespan);
    }

    [Fact]
    public async Task Expired_confirmation_link_returns_401()
    {
        // Identity's token provider has no test clock, so shrink the lifetime and let it pass.
        await using var shortLived = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            s.Configure<EmailConfirmationTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromMilliseconds(1))));
        var client = shortLived.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var email = NewEmail();
        await RegisterAsync(client, email);
        await Task.Delay(TimeSpan.FromMilliseconds(50), Ct);

        var response = await ConfirmAsync(client, ConfirmLinkFrom(LastEmailTo(email)));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Register_succeeds_when_email_delivery_fails()
    {
        var failing = new CapturingEmailDelivery { Fail = true };
        await using var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            s.AddSingleton<AspireApp1.Server.Email.IEmailDelivery>(failing)));
        var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        var response = await RegisterAsync(client, NewEmail());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, failing.Attempts); // sending was really attempted, and its failure swallowed
        Assert.Empty(failing.Sent);
    }

    [Fact]
    public async Task ForgotPassword_for_confirmed_account_sends_no_email_yet()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);
        await ConfirmAsync(client, ConfirmLinkFrom(LastEmailTo(email)));

        var response = await client.PostAsJsonAsync("/api/auth/forgotPassword", new { email }, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Single(factory.Emails.SentTo(email)); // only the confirmation email
    }

    [Fact]
    public async Task Resend_sends_a_new_confirmation_email()
    {
        var client = factory.CreateHttpsClient();
        var email = NewEmail();
        await RegisterAsync(client, email);

        var response = await client.PostAsJsonAsync("/api/auth/resendConfirmationEmail", new { email }, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, factory.Emails.SentTo(email).Count()); // sign-up + resend
    }

    [Fact]
    public async Task Second_resend_within_a_minute_is_rate_limited()
    {
        await using var limited = factory.WithWebHostBuilder(b =>
            b.UseSetting("RateLimits:ResendConfirmation:PermitLimit", "1"));
        var client = limited.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var email = NewEmail();
        await RegisterAsync(client, email);

        var first = await client.PostAsJsonAsync("/api/auth/resendConfirmationEmail", new { email }, Ct);
        var second = await client.PostAsJsonAsync("/api/auth/resendConfirmationEmail", new { email }, Ct);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
        Assert.Equal("application/problem+json", second.Content.Headers.ContentType?.MediaType);
        Assert.InRange(int.Parse(second.Headers.GetValues("Retry-After").Single()), 1, 60);
    }

    [Theory]
    [InlineData("/api/auth/resendConfirmationEmail/")]
    [InlineData("/API/AUTH/RESENDCONFIRMATIONEMAIL")]
    public async Task Other_spellings_of_the_resend_path_share_the_same_limit(string spelling)
    {
        await using var limited = factory.WithWebHostBuilder(b =>
            b.UseSetting("RateLimits:ResendConfirmation:PermitLimit", "1"));
        var client = limited.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var email = NewEmail();
        await RegisterAsync(client, email);

        var first = await client.PostAsJsonAsync("/api/auth/resendConfirmationEmail", new { email }, Ct);
        var second = await client.PostAsJsonAsync(spelling, new { email }, Ct);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
    }

    [Fact]
    public async Task Rate_limit_only_applies_to_email_sending_paths()
    {
        await using var limited = factory.WithWebHostBuilder(b =>
            b.UseSetting("RateLimits:ResendConfirmation:PermitLimit", "1"));
        var client = limited.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        for (var i = 0; i < 3; i++)
        {
            var response = await RegisterAsync(client, NewEmail());
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    private string LastEmailTo(string email) => factory.Emails.SentTo(email).Last().TextBody;

    /// <summary>The first https link in the email text.</summary>
    private static Uri ConfirmLinkFrom(string text) =>
        new(text.Split(['\n', ' '], StringSplitOptions.TrimEntries).First(w => w.StartsWith("https://")));

    private static Task<HttpResponseMessage> ConfirmAsync(HttpClient client, Uri link)
    {
        var query = QueryHelpers.ParseQuery(link.Query);
        return client.GetAsync(
            QueryHelpers.AddQueryString("/api/auth/confirmEmail",
                new Dictionary<string, string?> { ["userId"] = query["userId"], ["code"] = query["code"] }), Ct);
    }

    private static async Task<InfoDto> InfoAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<InfoDto>("/api/auth/manage/info", Ct))!;
}
