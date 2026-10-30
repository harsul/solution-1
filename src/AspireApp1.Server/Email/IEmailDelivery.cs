namespace AspireApp1.Server.Email;

/// <summary>Sends a finished message. MailKit/SMTP in the app, a capturing double in tests.</summary>
public interface IEmailDelivery
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}
