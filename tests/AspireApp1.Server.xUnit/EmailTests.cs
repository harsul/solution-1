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
            new IdentityUser { Email = "ada@example.com" }, "ada@example.com", "https://evil.example/api/auth/confirmEmail?userId=u1&amp;code=c1");

        var message = Assert.Single(delivery.Sent);
        Assert.Contains("https://app.test/confirm-email?userId=u1&code=c1", message.TextBody);
        Assert.DoesNotContain("evil.example", message.TextBody);
    }

    [Fact]
    public void Emails_use_the_product_name_from_Branding()
    {
        EmailMessage[] messages =
        [
            ConfirmEmailMessage.Create("a@example.com", "https://app.test/x"),
            ResetPasswordMessage.Create("a@example.com", "https://app.test/x"),
        ];

        Assert.All(messages, m => Assert.Contains(Branding.ProductName, m.TextBody));
        Assert.Equal(Branding.ProductName, new EmailOptions().FromName);
    }

    [Fact]
    public void ResetPasswordMessage_has_the_link_and_says_24_hours()
    {
        const string link = "https://app.test/reset-password?email=ada%40example.com&code=x<y";

        var message = ResetPasswordMessage.Create("ada@example.com", link);

        Assert.Equal("Reset your password", message.Subject);
        Assert.Contains(link, message.TextBody);
        Assert.Contains("24 hours", message.TextBody);
        Assert.Contains("code=x&lt;y", message.HtmlBody);
        Assert.DoesNotContain("x<y", message.HtmlBody);
    }

    [Theory]
    [InlineData("https://app.test", "https://app.test/reset-password?email=ada@example.com&code=c%2B1")] // "@" is valid in a query
    [InlineData("https://example.com/app/", "https://example.com/app/reset-password?email=ada@example.com&code=c%2B1")] // "@" is valid in a query
    public void Reset_link_keeps_the_public_url_path_and_encodes_values(string publicUrl, string expected)
    {
        Assert.Equal(expected, EmailLinks.ResetPassword(publicUrl, "ada@example.com", "c+1"));
    }

    [Fact]
    public void Confirm_link_has_changedEmail_only_when_given()
    {
        Assert.Equal("https://app.test/confirm-email?userId=u1&code=c1&changedEmail=new@example.com",
            EmailLinks.ConfirmEmail("https://app.test", "u1", "c1", "new@example.com"));
        Assert.DoesNotContain("changedEmail", EmailLinks.ConfirmEmail("https://app.test", "u1", "c1"));
    }

    [Fact]
    public async Task Sender_keeps_changedEmail_and_sends_to_it()
    {
        var delivery = new RecordingDelivery();
        var sender = NewSender(delivery);

        await sender.SendConfirmationLinkAsync(
            new IdentityUser { Email = "old@example.com" }, "new@example.com",
            "https://evil.example/api/auth/confirmEmail?userId=u1&amp;code=c1&amp;changedEmail=new%40example.com");

        var message = Assert.Single(delivery.Sent);
        Assert.Equal("new@example.com", message.To);
        Assert.Contains("https://app.test/confirm-email?userId=u1&code=c1&changedEmail=new@example.com", message.TextBody);
    }

    [Fact]
    public async Task Sender_sends_a_plain_confirmation_to_the_stored_address_not_the_typed_one()
    {
        var delivery = new RecordingDelivery();

        await NewSender(delivery).SendConfirmationLinkAsync(
            new IdentityUser { Email = "ada@example.com" }, "ADA@EXAMPLE.COM",
            "https://api.test/api/auth/confirmEmail?userId=u1&amp;code=c1");

        Assert.Equal("ada@example.com", Assert.Single(delivery.Sent).To);
    }

    [Fact]
    public async Task Reset_sender_decodes_the_code_and_sends_to_the_stored_address()
    {
        var delivery = new RecordingDelivery();

        // The code arrives HTML-encoded; the email parameter must not decide the recipient.
        await NewSender(delivery).SendPasswordResetCodeAsync(
            new IdentityUser { Email = "ada@example.com" }, "ADA@EXAMPLE.COM", "ab-_&#x2B;c");

        var message = Assert.Single(delivery.Sent);
        Assert.Equal("ada@example.com", message.To);
        Assert.Equal("Reset your password", message.Subject);
        Assert.Contains("https://app.test/reset-password?email=ada@example.com&code=ab-_%2Bc", message.TextBody);
    }

    [Fact]
    public async Task Reset_link_sender_sends_nothing()
    {
        var delivery = new RecordingDelivery();

        await NewSender(delivery).SendPasswordResetLinkAsync(
            new IdentityUser { Email = "ada@example.com" }, "ada@example.com", "https://api.test/x");

        Assert.Empty(delivery.Sent);
    }

    private static IdentityEmailSender NewSender(IEmailDelivery delivery) =>
        new(delivery, Options.Create(new EmailOptions { PublicUrl = "https://app.test" }), NullLogger<IdentityEmailSender>.Instance);

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
