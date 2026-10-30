using System.Data.Common;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace AspireApp1.Server.Email;

/// <summary>
/// Sends through SMTP with MailKit. The SMTP server comes from the <c>mailpit</c> connection string
/// (<c>endpoint=smtp://host:port</c>, set by Aspire); Mailpit needs no TLS or credentials.
/// </summary>
internal sealed class MailKitEmailDelivery(IConfiguration configuration, IOptions<EmailOptions> options) : IEmailDelivery
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var endpoint = ReadSmtpEndpoint(configuration.GetConnectionString("mailpit"));

        var mime = new MimeMessage();
        mime.From.Add(new MailboxAddress(options.Value.FromName, options.Value.FromAddress));
        mime.To.Add(MailboxAddress.Parse(message.To));
        mime.Subject = message.Subject;
        mime.Body = new BodyBuilder { TextBody = message.TextBody, HtmlBody = message.HtmlBody }.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(endpoint.Host, endpoint.Port, SecureSocketOptions.None, cancellationToken);
        await client.SendAsync(mime, cancellationToken);
        await client.DisconnectAsync(quit: true, cancellationToken);
    }

    internal static Uri ReadSmtpEndpoint(string? connectionString)
    {
        var builder = new DbConnectionStringBuilder { ConnectionString = connectionString ?? "" };
        if (builder.TryGetValue("endpoint", out var value) && Uri.TryCreate(value?.ToString(), UriKind.Absolute, out var uri))
        {
            return uri;
        }

        throw new InvalidOperationException("Missing SMTP endpoint: set ConnectionStrings:mailpit to 'endpoint=smtp://host:port'.");
    }
}
