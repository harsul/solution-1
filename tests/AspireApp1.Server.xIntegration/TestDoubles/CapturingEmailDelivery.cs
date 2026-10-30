using System.Collections.Concurrent;
using AspireApp1.Server.Email;

namespace AspireApp1.Server.xIntegration.TestDoubles;

/// <summary>Collects sent emails instead of delivering them; can be told to fail.</summary>
public sealed class CapturingEmailDelivery : IEmailDelivery
{
    private readonly ConcurrentQueue<EmailMessage> _sent = new();

    private int _attempts;

    public bool Fail { get; set; }

    /// <summary>How often sending was attempted, including failed attempts.</summary>
    public int Attempts => _attempts;

    public IReadOnlyCollection<EmailMessage> Sent => _sent;

    public IEnumerable<EmailMessage> SentTo(string email) => _sent.Where(m => m.To == email);

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref _attempts);
        if (Fail) throw new InvalidOperationException("Test delivery failure");
        _sent.Enqueue(message);
        return Task.CompletedTask;
    }
}
