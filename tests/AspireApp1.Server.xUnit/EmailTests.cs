using AspireApp1.Server.Email;
using AspireApp1.Server.Email.Messages;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace AspireApp1.Server.xUnit;

public class EmailTests
{
    [Fact]
    public void ConfirmEmailMessage_has_the_link_in_text_and_html_encoded_in_html()
    {
        const string link = "https://app.test/confirm-email?userId=abc&code=x<y";

        var message = ConfirmEmailMessage.Create("ada@example.com", link);

        Assert.Equal("ada@example.com", message.To);
        Assert.Equal("Confirm your email address", message.Subject);
        Assert.Contains(link, message.TextBody);
        Assert.Contains("https://app.test/confirm-email?userId=abc&amp;code=x&lt;y", message.HtmlBody);
        Assert.DoesNotContain("x<y", message.HtmlBody);
        Assert.Contains("24 hours", message.TextBody);
    }

    [Theory]
    [InlineData("endpoint=smtp://localhost:1025", "localhost", 1025)]
    [InlineData("Endpoint=smtp://mailpit:25", "mailpit", 25)]
    public void Reads_the_smtp_endpoint_from_the_Aspire_connection_string(string connectionString, string host, int port)
    {
        var endpoint = MailKitEmailDelivery.ReadSmtpEndpoint(connectionString);

        Assert.Equal(host, endpoint.Host);
        Assert.Equal(port, endpoint.Port);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("host=localhost")]
    public void Missing_smtp_endpoint_is_a_clear_error(string? connectionString)
    {
        var error = Assert.Throws<InvalidOperationException>(() => MailKitEmailDelivery.ReadSmtpEndpoint(connectionString));
        Assert.Contains("ConnectionStrings:mailpit", error.Message);
    }

    [Theory]
    [InlineData("https://app.test", "https://app.test/confirm-email?userId=u1&code=c%2B1")]
    [InlineData("https://app.test/", "https://app.test/confirm-email?userId=u1&code=c%2B1")]
    [InlineData("https://example.com/app", "https://example.com/app/confirm-email?userId=u1&code=c%2B1")]
    [InlineData("https://example.com/app/", "https://example.com/app/confirm-email?userId=u1&code=c%2B1")]
    public void Confirm_link_keeps_the_public_url_path_and_encodes_values(string publicUrl, string expected)
    {
        Assert.Equal(expected, EmailLinks.ConfirmEmail(publicUrl, "u1", "c+1"));
    }

    [Theory]
    [InlineData("https://app.test", true)]
    [InlineData("http://localhost:5173", true)]
    [InlineData("https://example.com/app/", true)]
    [InlineData("https://", false)]
    [InlineData("http://x y", false)]
    [InlineData("ftp://app.test", false)]
    [InlineData("/relative", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Public_url_must_be_an_absolute_http_url(string? publicUrl, bool valid)
    {
        Assert.Equal(valid, EmailLinks.IsValidPublicUrl(publicUrl));
    }

    [Theory]
    [InlineData("https://api.test/api/auth/confirmEmail?userId=u1", "https://app.test")] // no code
    [InlineData("not a url", "https://app.test")]
    public async Task Sender_never_throws_and_sends_nothing_for_a_link_without_userId_and_code(string builtInLink, string publicUrl)
    {
        var delivery = new RecordingDelivery();
        var sender = new IdentityEmailSender(
            delivery, Options.Create(new EmailOptions { PublicUrl = publicUrl }), NullLogger<IdentityEmailSender>.Instance);

        await sender.SendConfirmationLinkAsync(new IdentityUser(), "ada@example.com", builtInLink);

        Assert.Empty(delivery.Sent);
    }

    [Fact]
    public async Task Sender_rebuilds_the_built_in_link_for_the_frontend()
    {
        var delivery = new RecordingDelivery();
        var sender = new IdentityEmailSender(
            delivery, Options.Create(new EmailOptions { PublicUrl = "https://app.test" }), NullLogger<IdentityEmailSender>.Instance);

        // Identity passes the link HTML-encoded.
        await sender.SendConfirmationLinkAsync(
            new IdentityUser(), "ada@example.com", "https://evil.example/api/auth/confirmEmail?userId=u1&amp;code=c1");

        var message = Assert.Single(delivery.Sent);
        Assert.Contains("https://app.test/confirm-email?userId=u1&code=c1", message.TextBody);
        Assert.DoesNotContain("evil.example", message.TextBody);
    }

    private sealed class RecordingDelivery : IEmailDelivery
    {
        public List<EmailMessage> Sent { get; } = [];

        public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
        {
            Sent.Add(message);
            return Task.CompletedTask;
        }
    }
}
